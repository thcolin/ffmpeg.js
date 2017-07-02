// Usage (in ffmpeg.js/test folder) : node debug.js [youtube|mp4|wemb] [ffmpeg command]
var fs = require('fs')
var path = require('path')
var ffmpeg = require('../ffmpeg-' + process.argv[2])

function filedata(arg){
  var filepath = path.join(__dirname, arg)
  var data = new Uint8Array(fs.readFileSync(filepath))
  return data
}

var options = {
  arguments: process.argv.slice(3),
  stdin: function(){},
  print: function(msg){
    console.log('[stdout]', msg)
  },
  printErr: function(msg){
    console.log('[stderr]', msg)
  },
  onExit: function(code){
    console.log('[exit]', code)
  }
}

console.log('[args]', options.arguments.join(' '))

if(options.arguments[0] === '-i'){
  var file = options.arguments[1]
  var data = filedata(file)
  options.MEMFS = [{name: file, data: data}]
}

var output = ffmpeg(options)
console.log('[output]', output)

if(output.MEMFS.length){
  // should ask for confirmation
  fs.writeFileSync(path.join(__dirname, output.MEMFS[0].name), output.MEMFS[0].data)
}
