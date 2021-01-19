import { autoUpdater, UpdateInfo } from "electron-updater";
import logger from "./logger";
import { NotificationChannelAdd, NotificationChannelPrefix } from "../common/notification-ipc";
import { ipcMain } from "electron";
import { isDevelopment, isTestEnv } from "../common/vars";
import { WindowManager } from "./window-manager";
import { delay } from "../common/utils";

class NotificationBackchannel {
  private static _id = 0;

  static nextId(): string {
    return `${NotificationChannelPrefix}${NotificationBackchannel._id++}`;
  }
}

const title = "Lens Updater";

async function autoUpdateCheck(windowManager: WindowManager, args: UpdateInfo): Promise<void> {
  return new Promise(async resolve => {
    const body = `Version ${args.version} of Lens IDE is now available. Would you like to update?`;
    const yesNowChannel = NotificationBackchannel.nextId();
    const yesLaterChannel = NotificationBackchannel.nextId();
    const noChannel = NotificationBackchannel.nextId();

    function cleanupChannels() {
      ipcMain.removeAllListeners(yesNowChannel);
      ipcMain.removeAllListeners(yesLaterChannel);
      ipcMain.removeAllListeners(noChannel);
    }

    ipcMain
      .on(yesNowChannel, async () => {
        logger.info("[UPDATE CHECKER]: User chose to update immediately");
        cleanupChannels();

        await autoUpdater.downloadUpdate();
        autoUpdater.quitAndInstall();

        resolve();
      })
      .on(yesLaterChannel, async () => {
        logger.info("[UPDATE CHECKER]: User chose to update on quit");
        cleanupChannels();

        await autoUpdater.downloadUpdate();
        autoUpdater.autoInstallOnAppQuit = true;

        resolve();
      })
      .on(noChannel, () => {
        logger.info("[UPDATE CHECKER]: User chose not to update");
        cleanupChannels();
        resolve();
      });

    windowManager.sendToView({
      channel: NotificationChannelAdd,
      data: [{
        title,
        body,
        status: "info",
        buttons: [
          {
            label: "Yes, now",
            backchannel: yesNowChannel,
            action: true,
          },
          {
            label: "Yes, on quit",
            backchannel: yesLaterChannel,
            action: true,
          },
          {
            label: "No",
            backchannel: noChannel,
            secondary: true
          }
        ],
        closeChannel: noChannel,
      }]
    });
  });
}

/**
 * starts the automatic update checking
 * @param interval milliseconds between interval to check on, defaults to 24h
 */
export function startUpdateChecking(windowManager: WindowManager, interval = 1000 * 60 * 60 * 24): void {
  if (isDevelopment || isTestEnv) {
    return;
  }

  autoUpdater.logger = logger;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater
    .on("update-available", async (args: UpdateInfo) => {
      try {
        await autoUpdateCheck(windowManager, args);
      } catch (error) {
        logger.error("[UPDATE CHECKER]: notification failed", { error: String(error) });
      }
    });

  async function helper() {
    while (true) {
      await checkForUpdates();
      await delay(interval);
    }
  }

  helper();
}

export async function checkForUpdates(): Promise<void> {
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    logger.error("[UPDATE CHECKER]: failed with an error", { error: String(error) });
  }
}
