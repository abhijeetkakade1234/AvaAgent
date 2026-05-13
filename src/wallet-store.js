import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import { Wallet } from "ethers";

import { ValidationError } from "./errors.js";

function assertWalletPath(walletPath) {
  if (typeof walletPath !== "string" || walletPath.trim() === "") {
    throw new ValidationError("A non-empty wallet path is required.");
  }

  if (!path.isAbsolute(walletPath)) {
    throw new ValidationError("Wallet path must be absolute.");
  }

  const normalizedPath = path.resolve(walletPath);
  const allowedBaseDir = path.resolve(process.cwd());
  const relativePath = path.relative(allowedBaseDir, normalizedPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new ValidationError("Wallet path must stay inside the current workspace.");
  }
}

async function assertPathWithinWorkspace(targetPath, basePath) {
  const resolvedBase = await fs.realpath(basePath);
  let currentPath = targetPath;
  while (!fsSync.existsSync(currentPath)) {
    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      throw new ValidationError("Wallet path could not be resolved inside the workspace.");
    }

    currentPath = parentPath;
  }

  const resolvedTarget = await fs.realpath(currentPath);
  const relativePath = path.relative(resolvedBase, resolvedTarget);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new ValidationError("Wallet path must stay inside the current workspace.");
  }
}

export async function createWalletFile({ password, walletPath, chainId }) {
  if (!password) {
    throw new ValidationError("Password is required to create a wallet.");
  }

  assertWalletPath(walletPath);

  const wallet = Wallet.createRandom();
  const encryptedJson = await wallet.encrypt(password);

  const payload = {
    version: 1,
    chainId,
    address: wallet.address,
    encryptedJson,
    createdAt: new Date().toISOString(),
  };

  await assertPathWithinWorkspace(path.dirname(walletPath), process.cwd());
  await fs.mkdir(path.dirname(walletPath), { recursive: true });
  await assertPathWithinWorkspace(path.dirname(walletPath), process.cwd());
  try {
    await fs.writeFile(walletPath, `${JSON.stringify(payload, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if (error?.code !== "EEXIST") {
      throw new ValidationError(`Unable to write wallet file at ${walletPath}.`, error);
    }

    throw new ValidationError(
      `Wallet file already exists at ${walletPath}. Refusing to overwrite it.`,
      error,
    );
  }

  return {
    address: wallet.address,
    walletPath,
  };
}

export async function readWalletRecord(walletPath) {
  assertWalletPath(walletPath);
  await assertPathWithinWorkspace(walletPath, process.cwd());

  let raw;
  try {
    raw = await fs.readFile(walletPath, "utf8");
  } catch (error) {
    throw new ValidationError(`Unable to read wallet file at ${walletPath}.`, error);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new ValidationError(`Wallet file at ${walletPath} is not valid JSON.`, error);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ValidationError(`Wallet file at ${walletPath} must contain a JSON object.`);
  }

  if (typeof parsed.encryptedJson !== "string" || parsed.encryptedJson.trim() === "") {
    throw new ValidationError(`Wallet file at ${walletPath} is missing encryptedJson.`);
  }

  return parsed;
}

export async function loadWalletFromFile({ password, walletPath, provider }) {
  if (!password) {
    throw new ValidationError("Password is required to unlock the wallet.");
  }

  const record = await readWalletRecord(walletPath);
  let wallet;
  try {
    wallet = await Wallet.fromEncryptedJson(record.encryptedJson, password);
  } catch (error) {
    throw new ValidationError(`Unable to decrypt wallet file at ${walletPath}.`, error);
  }

  return wallet.connect(provider);
}
