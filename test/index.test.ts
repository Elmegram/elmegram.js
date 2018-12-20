import { expect, test } from '@oclif/test'

import cmd = require('../src/cli')

describe('elmegram', () => {
  test
    .do(() => cmd.run(['./nonexistant']))
    .exit(cmd.FILE_NOT_FOUND)
    .it('fails when src file cannot be found')
})
