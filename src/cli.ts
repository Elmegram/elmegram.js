import { Command, flags } from '@oclif/command'
import * as Path from 'path'
import { promises as fs } from 'fs'

import * as Elmegram from './elmegram'

class ElmegramCli extends Command {
  static FILE_NOT_FOUND = 100
  static FILE_WRONG_EXTENSION = 101
  static TOKEN_NOT_FOUND = 200
  static TOKEN_EMPTY = 201
  static TOKEN_INVALID = 202

  static description = 'Run Elmegram bots.'

  static flags = {
    version: flags.version({ char: 'v' }),
    help: flags.help({ char: 'h' }),
    token: flags.string({
      char: 't',
      description: "the name of the environment variable containing the bot's token",
      default: 'TELEGRAM_TOKEN'
    }),
    dev: flags.boolean({
      char: 'd',
      description: "if set, compiles Elm file in dev mode, i. e. without --optimize",
      default: false
    })
  }

  static args = [
    {
      name: 'src',
      required: true,
      description: 'the Elm source file containing the bot'
    }
  ]

  async run() {
    const { args, flags } = this.parse(ElmegramCli)

    const token = await this.getToken(flags.token)
    const src = await this.validateSourceFile(args.src)
    await Elmegram.startPolling(token, src);
  }


  async getToken(tokenEnvVarName: string): Promise<string> {
    const token = process.env[tokenEnvVarName]
    if (token === undefined) {
      this.error(
        `I could not find a token in the environment variable ${tokenEnvVarName}. Please set that variable to your token or see more help with --help.`,
        { exit: ElmegramCli.TOKEN_NOT_FOUND }
      )
    } else {
      return token
    }
  }

  async validateSourceFile(src: string): Promise<string> {
    const absSrc = Path.resolve(src)
    try {
      await fs.stat(absSrc)
    } catch (e) {
      this.error(`I could not find ${absSrc}.`, { exit: ElmegramCli.FILE_NOT_FOUND })
    }
    if (Path.extname(absSrc) !== '.elm') {
      this.error(
        `The file ${src} is not an .elm file. Please provide me with an Elm source file.`,
        { exit: ElmegramCli.FILE_WRONG_EXTENSION }
      )
    }

    return absSrc
  }
}

export = ElmegramCli