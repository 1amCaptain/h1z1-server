// ======================================================================
//
//   GNU GENERAL PUBLIC LICENSE
//   Version 3, 29 June 2007
//   copyright (C) 2020 - 2021 Quentin Gruber
//   copyright (C) 2021 - 2022 H1emu community
//
//   https://github.com/QuentinGruber/h1z1-server
//   https://www.npmjs.com/package/h1z1-server
//
//   Based on https://github.com/psemu/soe-network
// ======================================================================

/* eslint-disable @typescript-eslint/no-unused-vars */
// TODO enable @typescript-eslint/no-unused-vars
import { ZoneClient2016 as Client } from "./classes/zoneclient";

import { ZoneServer2016 } from "./zoneserver";

const debug = require("debug")("ZoneServer");

import { joaat } from "h1emu-core";

let hax = require("./commands/hax").default;

let dev = require("./commands/dev").default;

let admin = require("./commands/admin").default;

let commands = require("./commands/commands").default;

import { _, Int64String, isPosInRadius, getDistance } from "../../utils/utils";

import { CraftManager } from "./classes/craftmanager";
import { inventoryItem, loadoutContainer } from "types/zoneserver";
import { Character2016 } from "./classes/character";
import { Vehicle2016 } from "./classes/vehicle";
import { ResourceIds } from "./enums";
import { TrapEntity } from "./classes/trapentity";
import { ExplosiveEntity } from "./classes/explosiveentity";
import { DoorEntity } from "./classes/doorentity";
import { BaseLightweightCharacter } from "./classes/baselightweightcharacter";
import { BaseFullCharacter } from "./classes/basefullcharacter";
import { Npc } from "./classes/npc";
import { TemporaryEntity } from "./classes/temporaryentity";

export class zonePacketHandlers {
  hax = hax;
  dev = dev;
  admin = admin;
  commands = commands;
  ClientIsReady;
  ClientFinishedLoading;
  Security;
  commandRecipeStart;
  commandFreeInteractionNpc;
  CommandSetInWater;
  CommandClearInWater;
  collisionDamage;
  lobbyGameDefinitionDefinitionsRequest;
  KeepAlive;
  clientUpdateMonitorTimeDrift;
  ClientLog;
  wallOfDataUIEvent;
  SetLocale;
  GetContinentBattleInfo;
  chatChat;
  ClientInitializationDetails;
  ClientLogout;
  GameTimeSync;
  Synchronization;
  commandExecuteCommand;
  commandInteractRequest;
  commandInteractCancel;
  commandStartLogoutRequest;
  CharacterSelectSessionRequest;
  profileStatsGetPlayerProfileStats;
  DtoHitSpeedTreeReport;
  GetRewardBuffInfo;
  PlayerUpdateManagedPosition;
  vehicleStateData;
  PlayerUpdateUpdatePositionClientToZone;
  characterRespawn;
  characterFullCharacterDataRequest;
  commandPlayerSelect;
  mountDismountRequest;
  commandInteractionString;
  mountSeatChangeRequest;
  constructionPlacementFinalizeRequest;
  commandItemDefinitionRequest;
  characterWeaponStance;
  firstTimeEvent;
  requestUseItem;
  constructionPlacementRequest;
  containerMoveItem;
  commandSuicide;
  vehicleDismiss;
  loadoutSelectSlot;
  constructor() {
    this.ClientIsReady = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      server.sendData(client, "ClientBeginZoning", {
        position: client.character.state.position,
        rotation: client.character.state.lookAt,
        skyData: server._weather2016,
      }); // Needed for trees

      server.sendData(client, "ClientUpdate.DoneSendingPreloadCharacters", {
        done: true,
      }); // Required for WaitForWorldReady

      server.sendData(client, "ClientUpdate.NetworkProximityUpdatesComplete", {
        done: true,
      }); // Required for WaitForWorldReady

      server.customizeDTO(client);

      client.character.startRessourceUpdater(client, server);
      server.sendData(client, "Character.CharacterStateDelta", {
        guid1: client.guid,
        guid2: "0x0000000000000000",
        guid3: "0x0000000040000000",
        guid4: "0x0000000000000000",
        gameTime: (server.getServerTime() & 0xffffffff) >>> 0,
      });

      server.sendData(client, "ZoneDoneSendingInitialData", {}); // Required for WaitForWorldReady
    };
    this.ClientFinishedLoading = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      client.currentPOI = 0; // clears currentPOI for POIManager
      server.sendGameTimeSync(client);
      if (client.firstLoading) {
        
       setTimeout(() => {
          server.sendData(client, "POIChangeMessage", {
            // welcome POI message
            messageStringId: 20,
            id: 99,
        });
        server.sendChatText(client, "Welcome to H1emu ! :D", true);
        server.sendChatText(client, `server population : ${_.size(server._characters)}`);
        if(client.isAdmin){
          server.sendChatText(client, "You are an admin !");
        }
      
      }, 10000);
        
        server.sendChatTextToAllOthers(client,
          `${client.character.name} has joined the server !`
        );
        client.firstLoading = false;
        client.pingTimer?.refresh();
        client.savePositionTimer = setTimeout(
          () => server.saveCharacterPosition(client),
          30000
        );

        
        const commands = [
          "hax",
          "dev",
          "admin",
          "location",
          "serverinfo",
          "clientinfo",
          "spawninfo",
          "help",
          "netstats",
          "me"
        ];
  
        commands.forEach((command) => {
          server.commandHashses[joaat(command.toUpperCase())] = command;
          console.log(server.commandHashses)
          server.sendData(client, "Command.AddWorldCommand", {
            command: command,
          });
        });
  
        server.sendData(client, "Synchronization", {
          serverTime: Int64String(server.getServerTime()),
          serverTime2: Int64String(server.getServerTime()),
        });
  
        server.sendData(client, "Character.WeaponStance", {
          // activates weaponstance key
          characterId: client.character.characterId,
          stance: 1,
        });
        server.giveStartingItems(client, true);
        server.updateEquipment(client); // needed or third person character will be invisible
        server.updateLoadout(client); // needed or all loadout context menu entries aren't shown
        if (!server._soloMode) {
          server.sendZonePopulationUpdate();
        }
        server.executeFuncForAllReadyClients(() => server.spawnCharacters);
      }

      client.isLoading = false;
    };
    this.Security = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      debug(packet);
    };
    this.commandRecipeStart = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      new CraftManager(client, server, packet.data.recipeId, packet.data.count);
    };
    this.CommandSetInWater = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      debug(packet);
      client.character.characterStates.inWater = true;
    };
    this.CommandClearInWater = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      debug(packet);
      client.character.characterStates.inWater = false;
    };
    this.commandFreeInteractionNpc = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      debug("FreeInteractionNpc");
      server.sendData(client, "Command.FreeInteractionNpc", {});
    };
    this.collisionDamage = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      const characterId = packet.data.characterId,
        damage = packet.data.damage,
        vehicle = server._vehicles[characterId];
      if (characterId === client.character.characterId) {
        server.playerDamage(client, damage * 5);
      } else if (vehicle) {
        server.damageVehicle(damage / 50, vehicle);
        //server.DTOhit(client, packet);
      }
    };
    this.lobbyGameDefinitionDefinitionsRequest = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      server.sendData(client, "LobbyGameDefinition.DefinitionsResponse", {
        definitionsData: { data: "" },
      });
    };
    this.KeepAlive = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      server.sendData(client, "KeepAlive", {
        gameTime: packet.data.gameTime,
      });
    };
    this.clientUpdateMonitorTimeDrift = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      // nothing for now
    };
    this.ClientLog = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      debug(packet);
    };
    this.wallOfDataUIEvent = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      debug("UIEvent");
    };
    this.SetLocale = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      debug("SetLocale");
    };
    this.GetContinentBattleInfo = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      server.sendData(client, "ContinentBattleInfo", {
        zones: [
          {
            id: 1,
            nameId: 1,
            descriptionId: 1,
            population: [],
            regionPercent: [],
            populationBuff: [],
            populationTargetPercent: [],
            name: "Z1", // could use this field to load a specific TileInfo
            hexSize: 100,
            isProductionZone: 1,
          },
        ],
      });
    };
    (this.chatChat = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      const { channel, message } = packet.data;
      server.sendChat(client, message);
    }),
      (this.ClientInitializationDetails = function (
        server: ZoneServer2016,
        client: Client,
        packet: any
      ) {
        // just in case
        if (packet.data.unknownDword1) {
          debug("ClientInitializationDetails : ", packet.data.unknownDword1);
        }
      });
    this.ClientLogout = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      debug("ClientLogout");
      if(client.hudTimer){
      clearTimeout(client.hudTimer); // clear the timer started at StartLogoutRequest
    }
      server.deleteClient(client);
    };
    this.GameTimeSync = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      server.sendGameTimeSync(client);
    };
    this.Synchronization = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      const serverTime = Int64String(server.getServerTime());
      server.sendData(client, "Synchronization", {
        time1: packet.data.time1,
        time2: packet.data.time2,
        clientTime: packet.data.clientTime,
        serverTime: serverTime,
        serverTime2: serverTime,
        time3: packet.data.clientTime + 2,
      });
    };
    (this.commandExecuteCommand = async function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      const args: string[] = packet.data.arguments.toLowerCase().split(" ");
      const commandHash = packet.data.commandHash,
      commandName = args[0];
      switch (commandHash) {
        case joaat("HELP"):
        case 3575372649: // /help
          const haxCommandList: string[] = [];
          Object.keys(this.hax).forEach((key) => {
            haxCommandList.push(`/hax ${key}`);
          });
          const devCommandList: string[] = [];
          Object.keys(this.dev).forEach((key) => {
            devCommandList.push(`/dev ${key}`);
          });
          const adminCommandList: string[] = [];
          Object.keys(this.admin).forEach((key) => {
            adminCommandList.push(`/admin ${key}`);
          });
          const commandList = ["/help", "/loc", "/spawninfo", "/serverinfo"];
          server.sendChatText(client, `Commands list:`);
          commandList
            .concat(haxCommandList, devCommandList, adminCommandList)
            .sort((a: string, b: string) => a.localeCompare(b))
            .forEach((command: string) => {
              server.sendChatText(client, `${command}`);
          });
          break;
        case joaat("HAX"):
          if (!!hax[commandName]) {
            if (
              client.isAdmin ||
              commandName === "list" ||
              server._allowedCommands.length === 0 ||
              server._allowedCommands.includes(commandName)
            ) {
              this.hax[commandName](server, client, args);
            } else {
              server.sendChatText(client, "You don't have access to that.");
            }
          } else {
            server.sendChatText(
              client,
              `Unknown command: /hax ${commandName} , display hax all commands by using /hax list`
            );
          }
          break;
        case joaat("DEV"):
        case 552078457: // dev
          if (!!dev[commandName]) {
            if (
              client.isAdmin ||
              commandName === "list" ||
              server._allowedCommands.length === 0 ||
              server._allowedCommands.includes(commandName)
            ) {
              this.dev[commandName](server, client, args);
            } else {
              server.sendChatText(client, "You don't have access to that.");
            }
          } else {
            server.sendChatText(
              client,
              `Unknown command: /dev ${commandName} , display dev all commands by using /dev list`
            );
          }
          break;
        case joaat("ADMIN"):
        case 997464845: // admin
          if (!!admin[commandName]) {
            if (
              client.isAdmin ||
              commandName === "list" ||
              server._allowedCommands.length === 0 ||
              server._allowedCommands.includes(commandName)
            ) {
              this.admin[commandName](server, client, args);
            } else {
              server.sendChatText(client, "You don't have access to that.");
            }
          } else {
            server.sendChatText(
              client,
              `Unknown command: /admin ${commandName} , display admin all commands by using /admin list`
            );
          }
          break;
        default:
          const command = server.commandHashses[commandHash];
          // TODO: IMPLEMENT PERMISSIONS
          console.log(commandHash)
          console.log(command)
          console.log(this.commands[command])
          if(command && commands[command]) {
            this.commands[command].function(server, client, args)
          }
          else {
            server.sendChatText(
              client,
              `[ERROR] Command not found.`
            );
          }
          break;
      }
    }),
      (this.commandInteractRequest = function (
        server: ZoneServer2016,
        client: Client,
        packet: any
      ) {
        server.sendData(client, "Command.InteractionString", {
          guid: packet.data.guid,
          stringId: 5463,
          unknown4: 0,
        });
        server.sendData(client, "Command.InteractionList", {
          guid: packet.data.guid,
          unknownBoolean1: true,
          unknownArray1: [
            {
              unknownDword1: 11,
              unknownDword2: 0,
              unknownDword3: 5463,
              unknownDword4: 51,
              unknownDword5: 1,
              unknownDword6: 0,
              unknownDword7: 0,
            },
          ],
          unknownString1: "",
          unknownBoolean2: true,
          unknownArray2: [],
          unknownBoolean3: false,
        });
      }),
      (this.commandInteractCancel = function (
        server: ZoneServer2016,
        client: Client,
        packet: any
      ) {
        debug("Interaction Canceled");
      });
    this.commandStartLogoutRequest = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      client.posAtLogoutStart = client.character.state.position;
      if (!client.character.isAlive) {
        // Exit to menu button on respawn screen
        server.sendData(client, "ClientUpdate.CompleteLogoutProcess", {});
        return;
      }
      server.dismountVehicle(client);
      const timerTime = 10000;
      server.sendData(client, "ClientUpdate.StartTimer", {
        stringId: 0,
        time: timerTime,
      });
      if (client.hudTimer != null) {
        clearTimeout(client.hudTimer);
      }
      client.hudTimer = setTimeout(() => {
        server.sendData(client, "ClientUpdate.CompleteLogoutProcess", {});
      }, timerTime);
    };
    this.CharacterSelectSessionRequest = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      server.sendData(client, "CharacterSelectSessionResponse", {
        status: 1,
        sessionId: client.loginSessionId,
      });
    };
    this.profileStatsGetPlayerProfileStats = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      server.sendData(
        client,
        "ProfileStats.PlayerProfileStats",
        require("../../../data/profilestats.json")
      );
    };
    this.DtoHitSpeedTreeReport = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      debug(packet);
      server.speedTreeUse(client, packet);
    };
    this.GetRewardBuffInfo = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      server.sendData(client, "RewardBuffInfo", {
        unknownFloat1: 1,
        unknownFloat2: 2,
        unknownFloat3: 3,
        unknownFloat4: 4,
        unknownFloat5: 5,
        unknownFloat6: 6,
        unknownFloat7: 7,
        unknownFloat8: 8,
        unknownFloat9: 9,
        unknownFloat10: 10,
        unknownFloat11: 11,
        unknownFloat12: 12,
      });
    };
    this.PlayerUpdateManagedPosition = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      const characterId: string = server._transientIds[packet.data.transientId],
        vehicle = characterId ? server._vehicles[characterId] : undefined;
      if (!vehicle) return;
      //if (!server._soloMode) {
      server.sendDataToAllOthersWithSpawnedEntity(
        server._vehicles,
        client,
        characterId,
        "PlayerUpdatePosition",
        {
          transientId: packet.data.transientId,
          positionUpdate: packet.data.positionUpdate,
        }
      );
      //}
      if (packet.data.positionUpdate.engineRPM) {
        vehicle.positionUpdate = packet.data.positionUpdate;
      }
      if (packet.data.positionUpdate.position) {
        vehicle.state.position = new Float32Array([
          packet.data.positionUpdate.position[0],
          packet.data.positionUpdate.position[1],
          packet.data.positionUpdate.position[2],
          1,
        ]);
        vehicle.getPassengerList().forEach((passenger: string) => {
          if (server._characters[passenger]) {
            server._characters[passenger].state.position = new Float32Array([
              packet.data.positionUpdate.position[0],
              packet.data.positionUpdate.position[1],
              packet.data.positionUpdate.position[2],
              1,
            ]);
          } else {
            debug(`passenger ${passenger} not found`);
            vehicle.removePassenger(passenger);
          }
        });
        if (client.vehicle.mountedVehicle === characterId) {
          if (
            !client.posAtLastRoutine ||
            !isPosInRadius(
              server._npcRenderDistance / 2.5,
              client.character.state.position,
              client.posAtLastRoutine
            )
          ) {
            server.executeFuncForAllReadyClients(() => server.vehicleManager);
          }
        }
      }
    };
    this.vehicleStateData = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      server.sendDataToAllOthersWithSpawnedEntity(
        server._vehicles,
        client,
        packet.data.guid,
        "Vehicle.StateData",
        {
          ...packet.data,
        }
      );
    };
    this.PlayerUpdateUpdatePositionClientToZone = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      client.character.positionUpdate = packet.data;
      if (packet.data.flags === 513) {
        // head rotation when in vehicle, client spams this packet every 1ms even if you dont move, disabled for now(it doesnt work anyway)
        return;
      }
      if (packet.data.flags === 510) {
        client.vehicle.falling = packet.data.unknown10_float;
      }
      const movingCharacter = server._characters[client.character.characterId];
      if (movingCharacter) {
        if (packet.data.horizontalSpeed) {
          client.character.isRunning =
            packet.data.horizontalSpeed >
            (client.character.isExhausted ? 5 : 6);
        }
        server.sendRawToAllOthersWithSpawnedCharacter(
          client,
          movingCharacter.characterId,
          server._protocol.createPositionBroadcast2016(
            packet.data.raw,
            movingCharacter.transientId
          )
        );
      }

      if (packet.data.position) {
        client.character.state.position = new Float32Array([
          packet.data.position[0],
          packet.data.position[1],
          packet.data.position[2],
          0,
        ]);

        if (
          client.hudTimer != null &&
          !isPosInRadius(
            1,
            client.character.state.position,
            client.posAtLogoutStart
          )
        ) {
          clearTimeout(client.hudTimer);
          client.hudTimer = null;
          client.isInteracting = false;
          server.sendData(client, "ClientUpdate.StartTimer", {
            stringId: 0,
            time: 0,
          }); // don't know how it was done so
        }
      } else if (
        packet.data.vehicle_position &&
        client.vehicle.mountedVehicle
      ) {
        server._vehicles[client.vehicle.mountedVehicle].state.position =
          new Float32Array([
            packet.data.vehicle_position[0],
            packet.data.vehicle_position[1],
            packet.data.vehicle_position[2],
            0,
          ]);
      }
      if (packet.data.rotation) {
        client.character.state.rotation = new Float32Array([
          packet.data.rotation[0],
          packet.data.rotation[1],
          packet.data.rotation[2],
          packet.data.rotation[3],
        ]);

        client.character.state.lookAt = new Float32Array([
          packet.data.lookAt[0],
          packet.data.lookAt[1],
          packet.data.lookAt[2],
          packet.data.lookAt[3],
        ]);
      }
    };
    this.characterRespawn = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      debug(packet);
      server.respawnPlayer(client);
    };
    this.characterFullCharacterDataRequest = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      const { characterId } = packet.data,
        entityData: BaseFullCharacter =
          server._npcs[characterId] ||
          server._vehicles[characterId] ||
          server._characters[characterId] ||
          0,
        entityType = server._npcs[characterId]
          ? 1
          : 0 || server._vehicles[characterId]
          ? 2
          : 0 || server._characters[characterId]
          ? 3
          : 0;

      if (!entityType) return;
      switch (entityType) {
        case 1: // npcs
          const npc = entityData as Npc;
          server.sendData(client, "LightweightToFullNpc", npc.pGetFull());
          break;
        case 2: // vehicles
          const vehicle = entityData as Vehicle2016;
          if (vehicle.vehicleId != 13) {
            server.sendData(
              client,
              "LightweightToFullVehicle",
              vehicle.pGetFullVehicle()
            );
            server.sendData(client, "ResourceEvent", {
              eventData: {
                type: 1,
                value: {
                  characterId: vehicle.characterId,
                  characterResources: vehicle.pGetResources(),
                },
              },
            });
          }
          for (const a in vehicle.seats) {
            server.sendDataToAllWithSpawnedEntity(
              server._characters,
              vehicle.seats[a],
              "Mount.DismountResponse",
              {
                // dismounts character
                characterId: vehicle.seats[a],
              }
            );
            const seatId = vehicle.getCharacterSeat(vehicle.seats[a]);
            server.sendDataToAllWithSpawnedEntity(
              server._characters,
              vehicle.seats[a],
              "Mount.MountResponse",
              {
                // mounts character
                characterId: vehicle.seats[a],
                vehicleGuid: vehicle.characterId, // vehicle guid
                seatId: seatId,
                unknownDword3: seatId === "0" ? 1 : 0, //isDriver
                identity: {},
              }
            );
          }

          if (vehicle.destroyedEffect != 0) {
            server.sendData(client, "Command.PlayDialogEffect", {
              characterId: vehicle.characterId,
              effectId: vehicle.destroyedEffect,
            });
          }
          if (vehicle.engineOn) {
            server.sendData(client, "Vehicle.Engine", {
              guid2: vehicle.characterId,
              engineOn: true,
            });
          }
          break;
        case 3: // characters
          const character = entityData as Character2016;
          character._equipment[1] = {
            // temporary to fix missing heads
            modelName: character.headActor,
            slotId: 1,
            guid: "0x0",
          };
          character._equipment[27] = {
            // temporary to fix missing hair
            modelName: character.hairModel,
            slotId: 27,
            guid: "0x0",
          };

          server.sendData(client, "LightweightToFullNpc", character.pGetFull());

          /*
          server.sendData(client, "LightweightToFullPc", {
            useCompression: false,
            unknownDword1: 0,
            positionUpdate: character.positionUpdate,
            fullPcData: {
              transientId: character.transientId,
              attachmentData: character.pGetAttachmentSlots(),
              resources: character.pGetResources()
            }
          });
          */
          server.updateEquipment(client, character);
          server.sendData(client, "Character.WeaponStance", {
            // activates weaponstance key
            characterId: character.characterId,
            stance: 1,
          });
          break;
        default:
          break;
      }
      if (entityData.onReadyCallback) {
        entityData.onReadyCallback(client);
        delete entityData.onReadyCallback;
      }
    };
    this.commandPlayerSelect = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      const { guid } = packet.data,
        entityData: BaseLightweightCharacter =
          server._objects[guid] ||
          server._vehicles[guid] ||
          server._doors[guid] ||
          0,
        entityType = server._objects[guid]
          ? 1
          : 0 || server._vehicles[guid]
          ? 2
          : 0 || server._doors[guid]
          ? 3
          : 0;

      if (
        !entityData ||
        !isPosInRadius(
          server._interactionDistance,
          client.character.state.position,
          entityData.state.position
        )
      )
        return;

      switch (entityType) {
        case 1: // object
          server.pickupItem(client, guid);
          break;
        case 2: // vehicle
          !client.vehicle.mountedVehicle
            ? server.mountVehicle(client, packet.data.guid)
            : server.dismountVehicle(client);
          break;
        case 3: // door
          const door = entityData as DoorEntity;
          if (door.moving) {
            return;
          }
          door.moving = true;
          setTimeout(function () {
            door.moving = false;
          }, 1000);
          server.sendDataToAll("PlayerUpdatePosition", {
            transientId: door.transientId,
            positionUpdate: {
              sequenceTime: 0,
              unknown3_int8: 0,
              position: door.state.position,
              orientation: door.isOpen ? door.closedAngle : door.openAngle,
            },
          });
          server.sendDataToAll("Command.PlayDialogEffect", {
            characterId: door.characterId,
            effectId: door.isOpen ? door.closeSound : door.openSound,
          });
          door.isOpen = !door.isOpen;
          break;
        default:
          break;
      }
    };
    this.mountDismountRequest = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      // only for driver seat
      server.dismountVehicle(client);
    };
    this.vehicleDismiss = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      const vehicleGuid = client.vehicle.mountedVehicle;
      if (vehicleGuid) {
        server.dismountVehicle(client);
        server.dismissVehicle(vehicleGuid);
      }
    };
    this.commandInteractionString = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      const { guid } = packet.data,
        entityData: BaseLightweightCharacter =
          server._objects[guid] ||
          server._vehicles[guid] ||
          server._doors[guid] ||
          0,
        entityType = server._objects[guid]
          ? 1
          : 0 || server._vehicles[guid]
          ? 2
          : 0 || server._doors[guid]
          ? 3
          : 0;

      if (
        !entityData ||
        !isPosInRadius(
          server._interactionDistance,
          client.character.state.position,
          entityData.state.position
        )
      )
        return;

      switch (entityType) {
        case 1: // object
          server.sendData(client, "Command.InteractionString", {
            guid: guid,
            stringId: 29,
          });
          break;
        case 2: // vehicle
          if (!client.vehicle.mountedVehicle) {
            server.sendData(client, "Command.InteractionString", {
              guid: guid,
              stringId: 15,
            });
          }
          break;
        case 3: // door
          server.sendData(client, "Command.InteractionString", {
            guid: guid,
            stringId: 78,
          });
          break;
        default:
          break;
      }
    };
    this.mountSeatChangeRequest = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      server.changeSeat(client, packet);
    };
    this.constructionPlacementFinalizeRequest = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      server.sendData(client, "Construction.PlacementFinalizeResponse", {
        status: 1,
        unknownString1: "",
      });
    };
    this.commandItemDefinitionRequest = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      debug(`ItemDefinitionRequest ID: ${packet.data.ID}`);

      const itemDef = server.getItemDefinition(packet.data.ID);

      if (!itemDef) {
        debug(
          `ERROR: No ItemDefinition found for ItemDefinitonID: ${packet.data.ID}`
        );
        return;
      }
      server.sendData(client, "Command.ItemDefinitionReply", {
        data: {
          ID: packet.data.ID,
          definitionData: {
            ...itemDef,
            HUD_IMAGE_SET_ID: itemDef.IMAGE_SET_ID,
            flags1: {
              ...itemDef,
            },
            flags2: {
              ...itemDef,
            },
            stats: [],
          },
        },
      });
    };
    this.characterWeaponStance = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      server.sendDataToAllOthersWithSpawnedEntity(
        server._characters,
        client,
        client.character.characterId,
        "Character.WeaponStance",
        {
          characterId: client.character.characterId,
          stance: packet.data.stance,
        }
      );
    };
    this.firstTimeEvent = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      /*
      server.sendData(client, "FirstTimeEvent.State", {
        unknownDword1: 0xffffffff,
        unknownDword2: 1,
        unknownBoolean1: false,
      });
      */
    };
    this.commandSuicide = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      server.killCharacter(client);
    };
    //#region ITEMS
    this.requestUseItem = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      debug(packet.data);
      const { itemGuid } = packet.data;
      if (!itemGuid) {
        server.sendChatText(client, "[ERROR] ItemGuid is invalid!");
        return;
      }
      const item = client.character.getInventoryItem(itemGuid);
      if (!item) {
        server.containerError(client, 5); // slot does not contain item
        return;
      }
      const loadoutSlotId = client.character.getActiveLoadoutSlot(itemGuid);
      if (
        loadoutSlotId &&
        client.character._containers[loadoutSlotId]?.itemGuid == itemGuid &&
        _.size(client.character._containers[loadoutSlotId].items) != 0
      ) {
        // prevents duping if client check is bypassed
        server.sendChatText(
          client,
          "[ERROR] Container must be empty to unequip."
        );
        return;
      }
      switch (packet.data.itemUseOption) {
        case 4: // normal item drop option
        case 73: // battery drop option
        case 79: // sparks drop option
          server.dropItem(client, item, packet.data.itemSubData?.count);
          break;
        case 60: //equip item
          const activeSlotId = client.character.getActiveLoadoutSlot(itemGuid);
          let loadoutSlotId = server.getAvailableLoadoutSlot(
            client.character,
            item.itemDefinitionId
          );
          const container = client.character.getItemContainer(itemGuid);
          if (server.isWeapon(item.itemDefinitionId)) {
            if (container) {
              const item = container.items[itemGuid];
              if (!item) {
                server.containerError(client, 5); // slot does not contain item
                return;
              }
              if (!loadoutSlotId) {
                loadoutSlotId = server.getLoadoutSlot(item.itemDefinitionId);
              }
              client.character.currentLoadoutSlot = loadoutSlotId;
              server.equipContainerItem(client, item, loadoutSlotId);
            } else {
              if (!activeSlotId) {
                server.containerError(client, 3); // unknown container
                return;
              }
              const loadoutItem = client.character._loadout[activeSlotId];
              if (!loadoutItem) {
                server.containerError(client, 5); // slot does not contain item
                return;
              }
              server.switchLoadoutSlot(client, loadoutItem);
            }
          } else {
            if (activeSlotId) {
              server.sendChatText(client, "[ERROR] Item is already equipped!");
              return;
            }
            if (!container) {
              server.containerError(client, 3); // unknown container
              return;
            }
            const item = container.items[itemGuid];
            if (!item) {
              server.containerError(client, 5); // slot does not contain item
              return;
            }
            server.equipContainerItem(
              client,
              item,
              server.getLoadoutSlot(item.itemDefinitionId)
            );
          }
          break;
        case 6: // shred
          server.shredItem(client, item);
          break;
        case 1: //eat
          server.eatItem(client, item);
          break;
        case 2: //drink
          server.drinkItem(client, item);
          break;
        case 3: //use
          server.useItem(client, item);
          break;
        case 17: //refuel
          server.refuelVehicle(client, item, packet.data.characterId2);
          break;
        case 52: //use medical
          server.useMedical(client, item);
          break;
        case 11: //ignite
          server.igniteOption(client, item);
          break;
        default:
          server.sendChatText(
            client,
            "[ERROR] ItemUseOption not mapped to a function."
          );
      }
    };
    this.constructionPlacementRequest = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      debug(packet.data);
      const item = client.character.getItemById(packet.data.itemDefinitionId);
      if (!item) {
        server.containerError(client, 5); // slot does not contain item
        return;
      }
      if (!server.removeInventoryItem(client, item)) {
        return;
      }
      const modelId = server.getItemDefinition(
        packet.data.itemDefinitionId
      ).PLACEMENT_MODEL_ID;
      const characterId = server.generateGuid(),
        transientId = server.getTransientId(characterId);
      const tempObj: any = {};
      let trap: TrapEntity, explosive: ExplosiveEntity;
      switch (packet.data.itemDefinitionId) {
        case 1804:
        case 4:
        case 156:
        case 1461:
        case 1531:
          // flare
          server._temporaryObjects[characterId] = new TemporaryEntity(
            characterId,
            transientId,
            1,
            client.character.state.position,
            client.character.state.lookAt
          ); // save tempObj
          setTimeout(function () {
            server.sendDataToAllWithSpawnedEntity(
              server._temporaryObjects,
              characterId,
              "Character.RemovePlayer",
              {
                characterId: characterId,
              }
            );
            delete server._temporaryObjects[characterId];
          }, 900000);
          break;
        case 1699:
          // IED
          server._explosives[characterId] = new ExplosiveEntity(
            characterId,
            transientId,
            9176,
            client.character.state.position,
            client.character.state.lookAt,
            true
          ); // save explosive
          break;
        case 74:
          // land mine
          explosive = new ExplosiveEntity(
            characterId,
            transientId,
            9176,
            client.character.state.position,
            client.character.state.lookAt
          );

          server._explosives[characterId] = explosive; // save npc
          setTimeout(function () {
            if (!server._explosives[characterId]) {
              // it happens when you die before the explosive is enable
              return;
            }
            // arming time
            explosive.mineTimer = setTimeout(() => {
              if (!explosive) {
                return;
              }
              for (const a in server._clients) {
                if (
                  getDistance(
                    server._clients[a].character.state.position,
                    explosive.state.position
                  ) < 0.6
                ) {
                  server.explosionDamage(explosive.state.position, characterId);
                  server.sendDataToAllWithSpawnedEntity(
                    server._explosives,
                    characterId,
                    "Character.PlayWorldCompositeEffect",
                    {
                      characterId: characterId,
                      effectId: 1875,
                      position: server._clients[a].character.state.position,
                    }
                  );
                  server.sendDataToAllWithSpawnedEntity(
                    server._explosives,
                    characterId,
                    "Character.RemovePlayer",
                    {
                      characterId: characterId,
                    }
                  );
                  delete server._explosives[characterId];
                  return;
                }
              }
              for (const a in server._vehicles) {
                if (
                  getDistance(
                    server._vehicles[a].state.position,
                    explosive.state.position
                  ) < 2.2
                ) {
                  server.explosionDamage(explosive.state.position, characterId);
                  server.sendDataToAllWithSpawnedEntity(
                    server._explosives,
                    characterId,
                    "Character.PlayWorldCompositeEffect",
                    {
                      characterId: characterId,
                      effectId: 1875,
                      position: server._vehicles[a].state.position,
                    }
                  );
                  server.sendDataToAllWithSpawnedEntity(
                    server._explosives,
                    characterId,
                    "Character.RemovePlayer",
                    {
                      characterId: characterId,
                    }
                  );
                  delete server._explosives[characterId];
                  return;
                }
              }
              if (server._explosives[characterId]) {
                explosive.mineTimer?.refresh();
              }
            }, 90);
          }, 5000);
          break;
        case 98:
          // punji sticks
          trap = new TrapEntity(
            characterId,
            transientId,
            56,
            client.character.state.position,
            client.character.state.lookAt
          );

          server._traps[characterId] = trap; // save trap
          setTimeout(function () {
            // arming time
            trap.trapTimer = setTimeout(() => {
              if (!server._traps[characterId]) {
                return;
              }
              for (const a in server._clients) {
                if (
                  getDistance(
                    server._clients[a].character.state.position,
                    trap.state.position
                  ) < 1.5 &&
                  server._clients[a].character.isAlive &&
                  !server._clients[a].vehicle.mountedVehicle
                ) {
                  server.playerDamage(server._clients[a], 500);
                  server.sendDataToAllWithSpawnedEntity(
                    server._traps,
                    characterId,
                    "Character.PlayWorldCompositeEffect",
                    {
                      characterId: "0x0",
                      effectId: 5116,
                      position: server._clients[a].character.state.position,
                    }
                  );

                  server.sendDataToAllWithSpawnedEntity(
                    server._traps,
                    characterId,
                    "Character.UpdateSimpleProxyHealth",
                    trap.pGetSimpleProxyHealth()
                  );
                  trap.health -= 1000;
                }
              }

              if (trap.health > 0) {
                trap.trapTimer?.refresh();
              } else {
                server.sendDataToAllWithSpawnedEntity(
                  server._traps,
                  characterId,
                  "Character.PlayWorldCompositeEffect",
                  {
                    characterId: "0x0",
                    effectId: 163,
                    position: trap.state.position,
                  }
                );
                server.sendDataToAllWithSpawnedEntity(
                  server._traps,
                  characterId,
                  "Character.RemovePlayer",
                  {
                    characterId: characterId,
                  }
                );
                delete server._traps[characterId];
                return;
              }
            }, 500);
          }, 3000);
          break;
        case 1415:
          // snare
          trap = new TrapEntity(
            characterId,
            transientId,
            9175,
            client.character.state.position,
            client.character.state.lookAt
          );
          server._traps[characterId] = trap; // save trap
          setTimeout(function () {
            // arming time
            trap.trapTimer = setTimeout(() => {
              if (!server._traps[characterId]) {
                return;
              }
              for (const a in server._clients) {
                if (
                  getDistance(
                    server._clients[a].character.state.position,
                    trap.state.position
                  ) < 1
                ) {
                  server.playerDamage(server._clients[a], 2000);
                  server._clients[a].character._resources[
                    ResourceIds.BLEEDING
                  ] += 41;
                  server.updateResourceToAllWithSpawnedCharacter(
                    client,
                    client.character.characterId,
                    client.character._resources[ResourceIds.BLEEDING] > 0
                      ? client.character._resources[ResourceIds.BLEEDING]
                      : 0,
                    ResourceIds.BLEEDING
                  );
                  server.sendDataToAllWithSpawnedEntity(
                    server._traps,
                    characterId,
                    "Character.PlayWorldCompositeEffect",
                    {
                      characterId: characterId,
                      effectId: 1630,
                      position: server._traps[characterId].state.position,
                    }
                  );
                  trap.isTriggered = true;
                  server.applyMovementModifier(client, 0.4, "snared");
                }
              }

              if (!trap.isTriggered) {
                trap.trapTimer?.refresh();
              } else {
                server.sendDataToAllWithSpawnedEntity(
                  server._traps,
                  characterId,
                  "Character.RemovePlayer",
                  {
                    characterId: characterId,
                  }
                );
                trap.actorModelId = 1974;
                server.worldObjectManager.createLootEntity(
                  server,
                  server.generateItem(1415),
                  trap.state.position,
                  trap.state.rotation,
                  15
                );
                delete server._traps[characterId];
              }
            }, 200);
          }, 3000);
          break;
        default:
          server.lootItem(client, item, 1);
          server.sendData(client, "Construction.PlacementResponse", {
            unknownDword1: packet.data.itemDefinitionId,
            model: modelId,
          });
          break;
      }
    };
    this.containerMoveItem = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      const {
        containerGuid,
        characterId,
        itemGuid,
        targetCharacterId,
        count,
        newSlotId,
      } = packet.data;
      // helper functions
      function combineItemStack(
        oldStackCount: number,
        targetContainer: loadoutContainer,
        item: inventoryItem
      ) {
        if (oldStackCount == count) {
          // if full stack is moved
          server.addContainerItem(client, item, targetContainer, count, false);
        } else {
          // if only partial stack is moved
          server.addContainerItem(
            client,
            server.generateItem(item.itemDefinitionId),
            targetContainer,
            count,
            false
          );
        }
      }

      if (characterId == client.character.characterId) {
        // from client container
        if (characterId == targetCharacterId) {
          // from / to client container
          const container = client.character.getItemContainer(itemGuid),
            targetContainer =
              client.character.getContainerFromGuid(containerGuid);
          if (container) {
            // from container
            const item = container.items[itemGuid],
              oldStackCount = item?.stackCount; // saves stack count before it gets altered
            if (!item) {
              server.containerError(client, 5); // slot does not contain item
              return;
            }
            if (targetContainer) {
              // to container
              if (
                container.containerGuid != targetContainer.containerGuid &&
                !server.getContainerHasSpace(
                  targetContainer,
                  item.itemDefinitionId,
                  count
                )
              ) {
                // allows items in the same container but different stacks to be stacked
                return;
              }
              if (!server.removeContainerItem(client, item, container, count)) {
                server.containerError(client, 5); // slot does not contain item
                return;
              }
              if (newSlotId == 0xffffffff) {
                combineItemStack(oldStackCount, targetContainer, item);
              } else {
                const itemStack = server.getAvailableItemStack(
                  targetContainer,
                  item.itemDefinitionId,
                  count,
                  newSlotId
                );
                if (itemStack) {
                  // add to existing item stack
                  const item = targetContainer.items[itemStack];
                  item.stackCount += count;
                  server.updateContainerItem(client, item, targetContainer);
                } else {
                  // add item to end
                  combineItemStack(oldStackCount, targetContainer, item);
                }
              }
            } else if (containerGuid == "0xffffffffffffffff") {
              // to loadout
              if (
                server.validateLoadoutSlot(item.itemDefinitionId, newSlotId)
              ) {
                server.equipContainerItem(client, item, newSlotId);
              }
            } else {
              // invalid
              server.containerError(client, 3); // unknown container
            }
          } else {
            // from loadout or invalid
            const loadoutItem = client.character.getLoadoutItem(itemGuid);
            if (!loadoutItem) {
              server.containerError(client, 5); // slot does not contain item
              return;
            }
            if (targetContainer) {
              // to container
              if (
                !server.getContainerHasSpace(
                  targetContainer,
                  loadoutItem.itemDefinitionId,
                  count
                )
              ) {
                return;
              }
              if (!server.removeLoadoutItem(client, loadoutItem.slotId)) {
                server.containerError(client, 5); // slot does not contain item
                return;
              }
              server.addContainerItem(
                client,
                loadoutItem,
                targetContainer,
                count,
                false
              );
            } else if (containerGuid == "0xffffffffffffffff") {
              // to loadout
              const loadoutItem = client.character.getLoadoutItem(itemGuid),
                oldLoadoutItem = client.character._loadout[newSlotId];
              if (!loadoutItem) {
                server.containerError(client, 5); // slot does not contain item
                return;
              }
              if (
                !server.validateLoadoutSlot(
                  loadoutItem.itemDefinitionId,
                  newSlotId
                )
              ) {
                server.sendChatText(client, "[ERROR] Invalid loadout slot.");
                return;
              }
              if (oldLoadoutItem.itemDefinitionId) {
                if (!server.removeLoadoutItem(client, oldLoadoutItem.slotId)) {
                  server.containerError(client, 5); // slot does not contain item
                  return;
                }
              }
              if (!server.removeLoadoutItem(client, loadoutItem.slotId)) {
                server.containerError(client, 5); // slot does not contain item
                return;
              }
              if (oldLoadoutItem.itemDefinitionId) {
                server.equipItem(
                  client,
                  oldLoadoutItem,
                  true,
                  loadoutItem.slotId
                );
              }
              server.equipItem(client, loadoutItem, true, newSlotId);
            } else {
              // invalid
              server.containerError(client, 3); // unknown container
            }
          }
        } else {
          // to external container
        }
      } else {
        // from external container
      }
    };
    this.loadoutSelectSlot = function (
      server: ZoneServer2016,
      client: Client,
      packet: any
    ) {
      const slot = client.character._loadout[packet.data.slotId];
      if (!slot) {
        server.sendChatText(client, "[ERROR] Target slot is empty!");
        return;
      }
      server.switchLoadoutSlot(client, slot);
    };
    //#endregion
  }

  processPacket(server: ZoneServer2016, client: Client, packet: any) {
    switch (packet.name) {
      case "ClientIsReady":
        this.ClientIsReady(server, client, packet);
        break;
      case "ClientFinishedLoading":
        this.ClientFinishedLoading(server, client, packet);
        break;
      case "Security":
        this.Security(server, client, packet);
        break;
      case "Command.RecipeStart":
        this.commandRecipeStart(server, client, packet);
        break;
      case "Command.FreeInteractionNpc":
        this.commandFreeInteractionNpc(server, client, packet);
        break;
      case "Command.SetInWater":
        this.CommandSetInWater(server, client, packet);
        break;
      case "Command.ClearInWater":
        this.CommandClearInWater(server, client, packet);
        break;
      case "Collision.Damage":
        this.collisionDamage(server, client, packet);
        break;
      case "LobbyGameDefinition.DefinitionsRequest":
        this.lobbyGameDefinitionDefinitionsRequest(server, client, packet);
        break;
      case "KeepAlive":
        this.KeepAlive(server, client, packet);
        break;
      case "ClientUpdate.MonitorTimeDrift":
        this.clientUpdateMonitorTimeDrift(server, client, packet);
        break;
      case "ClientLog":
        this.ClientLog(server, client, packet);
        break;
      case "WallOfData.UIEvent":
        this.wallOfDataUIEvent(server, client, packet);
        break;
      case "SetLocale":
        this.SetLocale(server, client, packet);
        break;
      case "GetContinentBattleInfo":
        this.GetContinentBattleInfo(server, client, packet);
        break;
      case "Chat.Chat":
        this.chatChat(server, client, packet);
        break;
      case "ClientInitializationDetails":
        this.ClientInitializationDetails(server, client, packet);
        break;
      case "ClientLogout":
        this.ClientLogout(server, client, packet);
        break;
      case "GameTimeSync":
        this.GameTimeSync(server, client, packet);
        break;
      case "Synchronization":
        this.Synchronization(server, client, packet);
        break;
      case "Command.ExecuteCommand":
        this.commandExecuteCommand(server, client, packet);
        break;
      case "Command.InteractRequest":
        this.commandInteractRequest(server, client, packet);
        break;
      case "Command.InteractCancel":
        this.commandInteractCancel(server, client, packet);
        break;
      case "Vehicle.Dismiss":
        this.vehicleDismiss(server, client, packet);
        break;
      case "Command.StartLogoutRequest":
        this.commandStartLogoutRequest(server, client, packet);
        break;
      case "CharacterSelectSessionRequest":
        this.CharacterSelectSessionRequest(server, client, packet);
        break;
      case "ProfileStats.GetPlayerProfileStats":
        this.profileStatsGetPlayerProfileStats(server, client, packet);
        break;
      case "DtoHitSpeedTreeReport":
        this.DtoHitSpeedTreeReport(server, client, packet);
        break;
      case "GetRewardBuffInfo":
        this.GetRewardBuffInfo(server, client, packet);
        break;
      case "PlayerUpdateManagedPosition":
        this.PlayerUpdateManagedPosition(server, client, packet);
        break;
      case "Vehicle.StateData":
        this.vehicleStateData(server, client, packet);
        break;
      case "PlayerUpdateUpdatePositionClientToZone":
        this.PlayerUpdateUpdatePositionClientToZone(server, client, packet);
        break;
      case "Character.Respawn":
        this.characterRespawn(server, client, packet);
        break;
      case "Character.FullCharacterDataRequest":
        this.characterFullCharacterDataRequest(server, client, packet);
        break;
      case "Command.PlayerSelect":
        this.commandPlayerSelect(server, client, packet);
        break;
      case "Mount.DismountRequest":
        this.mountDismountRequest(server, client, packet);
        break;
      case "Command.InteractionString":
        this.commandInteractionString(server, client, packet);
        break;
      case "Mount.SeatChangeRequest":
        this.mountSeatChangeRequest(server, client, packet);
        break;
      case "Construction.PlacementFinalizeRequest":
        this.constructionPlacementFinalizeRequest(server, client, packet);
        break;
      case "Command.ItemDefinitionRequest":
        this.commandItemDefinitionRequest(server, client, packet);
        break;
      case "Character.WeaponStance":
        this.characterWeaponStance(server, client, packet);
        break;
      case "FirstTimeEvent.Unknown1":
        this.firstTimeEvent(server, client, packet);
        break;
      case "Items.RequestUseItem":
        this.requestUseItem(server, client, packet);
        break;
      case "Construction.PlacementRequest":
        this.constructionPlacementRequest(server, client, packet);
        break;
      case "Container.MoveItem":
        this.containerMoveItem(server, client, packet);
        break;
      case "Command.Suicide":
        this.commandSuicide(server, client, packet);
        break;
      case "Loadout.SelectSlot":
        this.loadoutSelectSlot(server, client, packet);
        break;
      default:
        debug(packet);
        debug("Packet not implemented in packetHandlers");
        break;
    }
  }
  async reloadCommandCache() {
    delete require.cache[require.resolve("./commands/hax")];
    delete require.cache[require.resolve("./commands/dev")];
    delete require.cache[require.resolve("./commands/admin")];
    delete require.cache[require.resolve("./commands/commands")];
    hax = require("./commands/hax").default;
    dev = require("./commands/dev").default;
    admin = require("./commands/admin").default;
    commands = require("./commands/commands").default;
    this.hax = require("./commands/hax").default;
    this.dev = require("./commands/dev").default;
    this.admin = require("./commands/admin").default;
    this.commands = require("./commands/commands").default;
  }
}
