#!/usr/bin/env python

import cgi, os, os.path, subprocess, sys, tempfile

form = cgi.FieldStorage()

print 'Content-Type: application/x-javascript' #application/json'
print ''

data = form['filedata'].value
if not data.endswith('\n'):
    data += '\n'
datafile = tempfile.NamedTemporaryFile()
datafile.write(data)
datafile.flush()

os.chdir(os.path.dirname(os.readlink(__file__)))

args = ['../../jshydra/jshydra',
        'flamit.js',
        '--arg', form['filename'].value,
        datafile.name]

sys.stdout.flush()
retcode = subprocess.call(args, stdout=sys.stdout)
sys.exit(retcode)
