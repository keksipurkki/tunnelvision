import * as crypto from "crypto";
import * as util from "util";
import * as fs from "fs";

const generateKeyPair = util.promisify(crypto.generateKeyPair);
const keyFiles = ["ssh/ssh_host_rsa_key"];

async function generateSSHKey(fname: string) {

  console.log(`Generating SSH host key ${fname}`);

  const exportOptions = {
    format: "pem",
    type: "pkcs1"
  } as const;

  const { privateKey, publicKey } = await generateKeyPair("rsa", {
    modulusLength: 2048
  });

  fs.writeFileSync(`${fname}.pub`, publicKey.export(exportOptions));
  fs.writeFileSync(fname, privateKey.export(exportOptions));

}

export async function hostKeys() {
  const files = keyFiles.filter(path => !fs.existsSync(path));
  await Promise.all(files.map(generateSSHKey));
  return keyFiles;
}
