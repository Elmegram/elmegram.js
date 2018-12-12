import { expect, test } from '@oclif/test'
import * as Errors from '../src/errors'

import cmd = require('../src')

describe('elmegram', () => {
  test
    .do(() => cmd.run(['./nonexistant']))
    .exit(Errors.FILE_NOT_FOUND)
    .it('fails when src file cannot be found')
})
