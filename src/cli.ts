import { Command, flags } from '@oclif/command'
import * as Path from 'path'
import { promises as fs } from 'fs'
import { compile } from 'node-elm-compiler'

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
      description: "if set, compiles Elm file without --optimize",
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

    const validToken = await this.validateToken(flags.token)
    const src = await this.validateSourceFile(args.src)
    const compiled = await this.compile(src, flags.dev);
    Elmegram.startPolling(validToken, compiled)
  }


  async validateToken(tokenEnvVarName: string): Promise<Elmegram.ValidToken> {
    const unverifiedToken = process.env[tokenEnvVarName]
    if (unverifiedToken === undefined) {
      this.error(
        `I could not find a token in the environment variable ${tokenEnvVarName}. Please set that variable to your token or see more help with --help.`,
        { exit: ElmegramCli.TOKEN_NOT_FOUND }
      )
    }

    const { validToken, error } = await Elmegram.validateToken(unverifiedToken)
    if (error) {
      if (error instanceof Elmegram.EmptyToken) {
        this.error(
          `The token in the environment variable ${tokenEnvVarName} is empty. Please provide a valid token.`
          , { exit: ElmegramCli.TOKEN_EMPTY }
        )
      } else if (error instanceof Elmegram.BadToken) {
        this.error(
          `The token in the environment variable ${tokenEnvVarName} is not valid. Please check that there is no typo.`
          , { exit: ElmegramCli.TOKEN_INVALID }
        )
      }
    }

    return validToken
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

  async compile(src: string, dev: boolean): Promise<string> {
    this.log(`Compiling ${src}.`)
    const compiledPath = Path.resolve(__dirname, './compiled/bot.js')
    const shouldOptimize = !dev;
    return new Promise(resolve => {
      compile([src], { output: compiledPath, optimize: shouldOptimize }).on('close', () => {
        resolve(compiledPath);
      })
    })
  }
}

export = ElmegramCli