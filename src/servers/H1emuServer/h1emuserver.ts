// ======================================================================
//
//   GNU GENERAL PUBLIC LICENSE
//   Version 3, 29 June 2007
//   copyright (c) 2020 - 2021 Quentin Gruber
//   copyright (c) 2021 H1emu community
//
//   https://github.com/QuentinGruber/h1z1-server
//   https://www.npmjs.com/package/h1z1-server
//
//   Based on https://github.com/psemu/soe-network
// ======================================================================

import { EventEmitter } from "events";
import { H1emuProtocol } from "../../protocols/h1emuprotocol";
import { H1emuClient as Client } from "./h1emuclient";
import { Worker } from "worker_threads";

const debug = require("debug")("H1emuServer");
process.env.isBin && require("../shared/workers/udpServerWorker.js");

export class H1emuServer extends EventEmitter {
  _serverPort?: number;
  _protocol: any;
  _udpLength: number = 512;
  _clients: any = {};
  _connection: Worker;
  _pingTime: number = 10000; // ms
  _pingTimeout: number = 60000;
  _pingTimer: any;
  _isLogin: boolean;

  constructor(serverPort?: number) {
    super();
    this._serverPort = serverPort;
    this._protocol = new H1emuProtocol();
    this._connection = new Worker(`${__dirname}/workers/udpServerWorker.js`, {
      workerData: { serverPort: serverPort },
    });
    this._isLogin = serverPort?true:false;
  }

  start(): void {
    this._connection.on("message", (message) => {
      const { data: dataUint8, remote } = message;
      const data = Buffer.from(dataUint8);
      let client: any;
      const clientId = `${remote.address}:${remote.port}`

      if (!this._clients[clientId]) {
        client = this._clients[clientId] = new Client(remote);
        this.emit("connect", null, this._clients[clientId]);
      }
      else {
        client = this._clients[clientId]
      }

      switch(message.type) {
        case "incomingPacket":
          const packet = this._protocol.parse(data);
          if (!packet) return;
          switch(packet.name) {
            case "Ping":
              if(this._isLogin) this.ping(client);
              client.lastPing = Date.now();
              break;
            case "SessionReply":
              if(packet.data.status === 0) {
                client.session = true;
              }
              debug(`Received session reply from ${client.address}:${client.port}`);
              let connectionError = "Unknown error"
              switch(packet.data.status) {
                case 0:
                  console.log(`LoginConnection established`);
                  this._pingTimer = setTimeout(
                    () => this.ping(client),
                    this._pingTime
                  );
                  this.emit("session", null, client, packet.data.status);
                  break;
                case 1:
                  connectionError = "Zone not whitelisted"
                default:
                  debug(`LoginConnection refused: ${connectionError}`);
                  this.emit("sessionfailed", null, client, packet.data.status);
                  break;
              }
              break;
            default:
              this.emit("data", null, client, packet);
              break;
          }
          break;
        default:
          debug(`Unknown message type ${message.type}`)
          break;
      }

    });
    if(this._isLogin) { // only server (loginserver) has its port bound
      this._connection.postMessage({ type: "bind" });

      const zonePings = setTimeout(
        () => {
          for (const key in this._clients) {
            const client = this._clients[key];
            if(Date.now() > client.lastPing + this._pingTimeout) {
              this.emit("disconnect", null, client, 1);
              delete this._clients[client.clientId];
            }
          }
          zonePings.refresh();
        },
        this._pingTime
      );
    }
  }

  stop(): void {
    this._connection.postMessage({ type: "close" });
    process.exit(0);
  }

  sendData(client: Client = {} as Client, packetName: any, obj: any) {
    // blocks zone from sending packet without open session
    if(!client || !client.session && packetName !== "SessionRequest") return; 
    const data = this._protocol.pack(
      packetName,
      obj
    );
    this._connection.postMessage({
      type: "sendPacket",
      data: {
        packetData: data,
        port: client.port,
        address: client.address,
      },
    });
  }

  connect(serverInfo: any, obj: any) {
    this.sendData({address: serverInfo.address, port: serverInfo.port} as Client, "SessionRequest", obj)
  }

  ping(client: any) {
    this.sendData(client, "Ping", {});
    if(this._isLogin) return;
    if(Date.now() > client.lastPing + this._pingTimeout) {
      this.emit("disconnect", null, client, 1);
      delete this._clients[client.clientId];
      return;
    }
    this._pingTimer.refresh();
  }

}

exports.H1emuServer = H1emuServer;
