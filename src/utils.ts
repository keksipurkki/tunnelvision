import { URL } from "url";

export function tunnelEndpoint(prefix: string): URL {
  switch (process.env.NODE_ENV) {
    case "local":
      return new URL(`http://${prefix}.localhost`);
    default: {
      return new URL(`https://${prefix}.tunnelvision.me`);
    }
  }
}

export function homepage(): URL {
  switch (process.env.NODE_ENV) {
    case "local":
      return new URL("http://localhost");
    default: {
      return new URL("https://tunnelvision.me");
    }
  }
}
