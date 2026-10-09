import fs from "node:fs";
import path from "node:path";

const getCandidatePath = (targetPath: string, index: number) => {
  if (index === 0) return targetPath;

  const extension = path.extname(targetPath);
  const baseName = path.basename(targetPath, extension);
  return path.join(path.dirname(targetPath), `${baseName} (${index})${extension}`);
};

const isPathAlreadyExists = (error: unknown) =>
  (error as NodeJS.ErrnoException)?.code === "EEXIST";

export const writeFileWithoutOverwrite = async (
  targetPath: string,
  data: Uint8Array,
): Promise<string> => {
  for (let index = 0; ; index += 1) {
    const candidatePath = getCandidatePath(targetPath, index);
    try {
      await fs.promises.writeFile(candidatePath, data, { flag: "wx" });
      return candidatePath;
    } catch (error) {
      if (!isPathAlreadyExists(error)) throw error;
    }
  }
};

export const copyFileWithoutOverwrite = async (
  sourcePath: string,
  targetPath: string,
): Promise<string> => {
  for (let index = 0; ; index += 1) {
    const candidatePath = getCandidatePath(targetPath, index);
    try {
      await fs.promises.copyFile(sourcePath, candidatePath, fs.constants.COPYFILE_EXCL);
      return candidatePath;
    } catch (error) {
      if (!isPathAlreadyExists(error)) throw error;
    }
  }
};
