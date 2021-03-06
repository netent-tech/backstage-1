/*
 * Copyright 2020 Spotify AB
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'fs-extra';
import { Command } from 'commander';
import {
  diffTemplateFiles,
  handlers,
  handleAllFiles,
  inquirerPromptFunc,
  makeCheckPromptFunc,
  yesPromptFunc,
} from '../../lib/diff';
import { paths } from '../../lib/paths';
import { version as backstageVersion } from '../../lib/version';

export type PluginData = {
  id: string;
  name: string;
};

const fileHandlers = [
  {
    patterns: ['package.json'],
    handler: handlers.packageJson,
  },
  {
    patterns: ['tsconfig.json'],
    handler: handlers.exactMatch,
  },
  {
    // make sure files in 1st level of src/ and dev/ exist
    patterns: ['.eslintrc.js', /^(src|dev)\/[^/]+$/],
    handler: handlers.exists,
  },
  {
    patterns: ['README.md', /^src\//],
    handler: handlers.skip,
  },
];

export default async (cmd: Command) => {
  let promptFunc = inquirerPromptFunc;
  let finalize = () => {};

  if (cmd.check) {
    [promptFunc, finalize] = makeCheckPromptFunc();
  } else if (cmd.yes) {
    promptFunc = yesPromptFunc;
  }

  const { version } = await fs.readJson(paths.resolveTargetRoot('lerna.json'));

  const data = await readPluginData();
  const templateFiles = await diffTemplateFiles('default-plugin', {
    version,
    backstageVersion,
    ...data,
  });
  await handleAllFiles(fileHandlers, templateFiles, promptFunc);
  await finalize();
};

// Reads templating data from the existing plugin
async function readPluginData(): Promise<PluginData> {
  let name: string;
  try {
    const pkg = require(paths.resolveTarget('package.json'));
    name = pkg.name;
  } catch (error) {
    throw new Error(`Failed to read target package, ${error}`);
  }

  const pluginTsContents = await fs.readFile(
    paths.resolveTarget('src/plugin.ts'),
    'utf8',
  );
  // TODO: replace with some proper parsing logic or plugin metadata file
  const pluginIdMatch = pluginTsContents.match(/id: ['"`](.+?)['"`]/);
  if (!pluginIdMatch) {
    throw new Error(`Failed to parse plugin.ts, no plugin ID found`);
  }

  const id = pluginIdMatch[1];

  return { id, name };
}
