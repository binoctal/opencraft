#!/usr/bin/env node
// Shared utilities for Opencraft hooks.

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

/**
 * Run a command, return { ok, stdout, stderr, code }.
 * Never throws.
 */
function run(cmd, opts = {}) {
  try {
    const stdout = execSync(cmd, {
      encoding: "utf-8",
      timeout: opts.timeout || 60_000,
      stdio: ["pipe", "pipe", "pipe"],
      cwd: opts.cwd,
    });
    return { ok: true, stdout: stdout.trim(), stderr: "", code: 0 };
  } catch (e) {
    return {
      ok: false,
      stdout: (e.stdout || "").trim(),
      stderr: (e.stderr || "").trim(),
      code: e.status || 1,
    };
  }
}

/**
 * Print a hook result line for Claude to read.
 */
function pass(tag, msg) {
  console.log(`[${tag}] ✓ ${msg}`);
}

function warn(tag, msg) {
  console.log(`[${tag}] ⚠ ${msg}`);
}

function fail(tag, msg) {
  console.log(`[${tag}] ✗ ${msg}`);
}

function fileExists(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function dirExists(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function countLines(p) {
  try {
    return fs.readFileSync(p, "utf-8").split("\n").length;
  } catch {
    return 0;
  }
}

function readToolInput() {
  try {
    const data = fs.readFileSync(0, "utf-8");
    if (!data) return {};
    return JSON.parse(data);
  } catch {
    return {};
  }
}

/**
 * Resolve a path relative to the plugin root.
 * Works when called from a plugin hook via CLAUDE_PLUGIN_ROOT env var.
 */
function pluginPath(...segments) {
  const root = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, "..");
  return path.join(root, ...segments);
}

module.exports = {
  run, pass, warn, fail,
  fileExists, dirExists, countLines,
  readToolInput, pluginPath,
};
