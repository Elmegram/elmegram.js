import { Command, flags } from '@oclif/command'
import * as Errors from './errors'
import * as Path from 'path'
import { promises as fs } from 'fs';

class Elmegram extends Command {
  static description = 'Run Elmegram bots.'

  static flags = {
    version: flags.version({ char: 'v' }),
    help: flags.help({ char: 'h' }),
  }

  static args = [{
    name: 'src',
    required: true,
    description: 'the Elm source file containing the bot'
  }]

  async run() {
    const { args } = this.parse(Elmegram)

    const src = args.src;
    const absSrc = Path.resolve(src)
    try {
      const stats = await fs.stat(absSrc);
      this.log(stats.toString())
    } catch (e) {
      this.error(`I could not find ${absSrc}.`, { exit: Errors.FILE_NOT_FOUND })
    }

    this.log(`I will compile ${absSrc}.`)
  }
}

export = Elmegram
