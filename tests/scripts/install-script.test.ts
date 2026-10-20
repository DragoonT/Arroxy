import {spawnSync} from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {afterEach, describe, expect, it} from 'vite-plus/test'

const SCRIPT = path.resolve(import.meta.dirname, '../../scripts/install.sh')
const tempDirs: string[] = []

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, {recursive: true, force: true})))
})

// Runs the script the way the README does (`curl … | sh -s -- <flag>`), with a
// fake `uname` reporting macOS so a flag that parses stops at the OS check
// instead of installing anything.
async function runInstallScript(flag: string): Promise<{status: number | null; stderr: string}> {
	const binDir = await fs.mkdtemp(path.join(os.tmpdir(), 'arroxy-install-script-'))
	tempDirs.push(binDir)
	await fs.writeFile(path.join(binDir, 'uname'), '#!/bin/sh\necho Darwin\n', {mode: 0o755})
	const result = spawnSync('sh', ['-s', '--', flag], {input: await fs.readFile(SCRIPT, 'utf8'), env: {...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}`}, encoding: 'utf8'})
	return {status: result.status, stderr: result.stderr}
}

describe.skipIf(process.platform === 'win32')('install.sh options', () => {
	it.each(['--appimage', '--flatpak'])('accepts %s', async flag => {
		const {status, stderr} = await runInstallScript(flag)
		expect(status).toBe(1)
		expect(stderr).toContain('This script is for Linux')
		expect(stderr).not.toContain('Unknown option')
	})

	it('names every install option when given an unknown one', async () => {
		const {status, stderr} = await runInstallScript('--bogus')
		expect(status).toBe(1)
		expect(stderr).toContain('Unknown option: --bogus')
		expect(stderr).toContain('--appimage')
		expect(stderr).toContain('--flatpak')
	})
})
