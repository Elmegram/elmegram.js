import { Command, flags } from '@oclif/command'
import * as Path from 'path'
import { promises as fs } from 'fs'
import { compile } from 'node-elm-compiler'

import * as Elmegram from './elmegram'
import * as Errors from './errors'

class ElmegramCli extends Command {
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

    const tokenEnvVarName = flags.token
    const unverifiedToken = process.env[tokenEnvVarName]
    if (unverifiedToken === undefined) {
      this.error(
        `I could not find a token in the environment variable ${tokenEnvVarName}.\nPlease set that variable to your token or see more help with --help.`,
        { exit: Errors.TOKEN_NOT_FOUND }
      )
    }

    const { validToken, error } = await Elmegram.validateToken(unverifiedToken)
    if (error) {
      if (error instanceof Elmegram.EmptyToken) {
        this.error(
          `The token in the environment variable ${tokenEnvVarName} is empty. Please provide a valid token.`
          , { exit: Errors.TOKEN_EMPTY }
        )
      } else if (error instanceof Elmegram.BadToken) {
        this.error(
          `The token in the environment variable ${tokenEnvVarName} is not valid. Please check that there is no typo.`
          , { exit: Errors.TOKEN_INVALID }
        )
      }
    }

    const src = args.src
    const absSrc = Path.resolve(src)
    try {
      await fs.stat(absSrc)
    } catch (e) {
      this.error(`I could not find ${absSrc}.`, { exit: Errors.FILE_NOT_FOUND })
    }
    if (Path.extname(absSrc) !== '.elm') {
      this.error(`The file ${src} is not an .elm file. Please provide me with an Elm source file.`, { exit: Errors.FILE_WRONG_EXTENSION })
    }

    this.log(`Compiling ${absSrc}.`)
    const compiledPath = Path.resolve(__dirname, './compiled/bot.js')
    compile([absSrc], { output: compiledPath, optimize: !flags.dev }).on('close', exitCode => {
      Elmegram.startPolling(validToken, compiledPath)
    })
  }
}

export = ElmegramCli
