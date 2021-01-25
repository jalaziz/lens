import { AppConstructorOptions, Application } from "spectron";
import fse from "fs-extra";
import path from "path";

interface AppTestingPaths {
  testingPath: string,
  libraryPath: string,
}

function getAppTestingPaths(): AppTestingPaths {
  switch (process.platform) {
    case "win32":
      return {
        testingPath: "./dist/win-unpacked/Lens.exe",
        libraryPath: path.join(process.env.APPDATA, "Lens"),
      };
    case "linux":
      return {
        testingPath: "./dist/linux-unpacked/kontena-lens",
        libraryPath: path.join(process.env.XDG_CONFIG_HOME || path.join(process.env.HOME, ".config"), "Lens"),
      };
    case "darwin":
      return {
        testingPath: "./dist/mac/Lens.app/Contents/MacOS/Lens",
        libraryPath: path.join(process.env.HOME, "Library/Application\ Support/Lens"),
      };
    default:
      throw new TypeError(`platform ${process.platform} is not supported`);
  }
}

export function itIf(condition: boolean) {
  return condition ? it : it.skip;
}

export function describeIf(condition: boolean) {
  return condition ? describe : describe.skip;
}

export function setup(): AppConstructorOptions {
  const appPath = getAppTestingPaths();

  fse.removeSync(appPath.libraryPath); // remove old install config

  return {
    path: appPath.testingPath,
    args: [],
    startTimeout: 30000,
    waitTimeout: 60000,
    env: {
      CICD: "true"
    }
  };
}

type AsyncPidGetter = () => Promise<number>;

export async function tearDown(app: Application) {
  const pid = await (app.mainProcess.pid as any as AsyncPidGetter)();

  await app.stop();

  try {
    process.kill(pid, "SIGKILL");
  } catch (e) {
    console.error(e);
  }
}

const rendererLogPrefixMatcher = /^\[[0-9]{5}:[0-9]{4}\/[0-9]{6}\.[0-9]{6}:[A-Z]+:CONSOLE\([0-9)]+\)\]/;

/**
 * Wait for all of `values` to be part of the logs. Does not clear logs. Does
 * not work well with `app.client.get(Main|Renderer)ProcessLogs()`
 *
 * Note: this is a "best attempt" since spectron's `getMainProcessLogs` sometimes
 * contains `renderer` logs.
 * @param app The spectron app that we are testing against
 * @param source Whether to wait for renderer or main logs
 * @param values The list of strings that should all be contained in the logs
 */
export async function waitForLogsToContain(app: Application, source: "renderer" | "main", ...values: string[]): Promise<void> {
  const notFoundValues = new Set(values);
  let lastLogLineCount = 0;

  while (notFoundValues.size > 0) {
    // get all the logs (this returns both) and doesn't clear them
    const curLogs = ((app as any).chromeDriver.getLogs() as string[]);

    // skip the logs already seen
    const newLogs = curLogs.slice(lastLogLineCount);

    lastLogLineCount += newLogs.length;

    // filter the logs depending on whether we are waiting for logs from main or renderer
    const filteredLogs = newLogs.filter(logLine => (source === "main") !== Boolean(logLine.match(rendererLogPrefixMatcher)));

    for (const logLine of filteredLogs) {
      if (notFoundValues.size === 0) {
        break;
      }

      for (const value of notFoundValues) {
        if (logLine.includes(value)) {
          notFoundValues.delete(value);
        }
      }
    }

    await new Promise(resolve => setTimeout(resolve, 500)); // long poll getting logs
  }
}
