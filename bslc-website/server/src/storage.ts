/* File storage behind a small interface. LocalDiskStorage is for
   development and single-server deployments; production should provide an
   S3-compatible / NIC object-storage driver implementing the same methods
   (with server-side encryption and versioning enabled on the bucket). */
import fs from "fs";
import path from "path";
import { config } from "./config";

export interface StorageDriver {
  put(key: string, sourcePath: string): Promise<void>;
  read(key: string): fs.ReadStream;
  remove(key: string): Promise<void>;
}

const KEY_RULE = /^\d{4}\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/;

export class LocalDiskStorage implements StorageDriver {
  constructor(private root: string) {}

  private resolve(key: string) {
    if (!KEY_RULE.test(key)) throw new Error("Invalid storage key");
    return path.join(this.root, key);
  }

  async put(key: string, sourcePath: string) {
    const dest = this.resolve(key);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.copyFile(sourcePath, dest, fs.constants.COPYFILE_EXCL);
  }

  read(key: string) {
    return fs.createReadStream(this.resolve(key));
  }

  async remove(key: string) {
    await fs.promises.rm(this.resolve(key), { force: true });
  }
}

export const storage: StorageDriver = new LocalDiskStorage(path.resolve(config.STORAGE_DIR));
