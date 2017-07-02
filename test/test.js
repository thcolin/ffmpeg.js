// TODO(Kagami): In-browser tests with karma.
var expect = require("chai").expect;
var fs = require("fs");
var path = require("path");
var md5 = require("js-md5");
var Worker = require("webworker-threads").Worker;
var ffmpeg_webm = require("../ffmpeg-webm");
var ffmpeg_mp4 = require("../ffmpeg-mp4");
var ffmpeg_youtube = require("../ffmpeg-youtube");
var testDataCache = {}

function noop() {}
function testData(format, youtube){
  format = format || 'webm';
  var filename = (youtube ? 'youtube':'test');
  var filepath = path.join(__dirname, filename + "." + format);

  if(!testDataCache[filepath]){
    testDataCache[filepath] = new Uint8Array(fs.readFileSync(filepath));
  }

  return testDataCache[filepath];
}
// Mute uncaughtException warnings.
process.setMaxListeners(30);

describe("WebM", function() {
  this.timeout(10000);

  describe("Sync", function() {
    it("should print version to stdout", function(done) {
      var stdout = "";
      var stderr = "";
      ffmpeg_webm({
        arguments: ["-version"],
        print: function(data) { stdout += data + "\n"; },
        printErr: function(data) { stderr += data + "\n"; },
        onExit: function(code) {
          expect(code).to.equal(0);
          expect(stderr).to.be.empty;
          expect(stdout).to.match(/^ffmpeg version /);
          done();
        },
      });
    });

    it("shouldn't return input files at MEMFS", function() {
      var res = ffmpeg_webm({
        arguments: [],
        print: noop,
        printErr: noop,
        MEMFS: [
          {name: "test.mkv", data: new Uint8Array(1)},
          {name: "222.webm", data: new Uint8Array(10)},
        ],
      });
      expect(res.MEMFS).to.be.empty;
    });

    it("should show metadata of test file at NODEFS", function() {
      var stderr = "";
      ffmpeg_webm({
        arguments: ["-i", "/data/test.webm"],
        print: noop,
        printErr: function(data) { stderr += data + "\n"; },
        mounts: [{type: "NODEFS", opts: {root: "test"}, mountpoint: "/data"}],
      });
      expect(stderr).to.match(/^Input.*matroska,webm/m);
      expect(stderr).to.match(/^\s+Stream.*Video: vp8/m);
      expect(stderr).to.match(/^\s+Stream.*Audio: vorbis/m);
    });

    it("should encode test file to WebM/VP8 at MEMFS", function() {
      this.timeout(60000);
      var code;
      var res = ffmpeg_webm({
        arguments: [
          "-i", "test.webm",
          "-frames:v", "5", "-c:v", "libvpx",
          "-an",
          "out.webm",
        ],
        stdin: noop,
        print: noop,
        printErr: noop,
        onExit: function(v) {code = v},
        MEMFS: [{name: "test.webm", data: testData()}],
      });
      expect(code).to.equal(0);
      expect(res.MEMFS).to.have.length(1);
      var file = res.MEMFS[0];
      expect(file.name).to.equal("out.webm");
      expect(file.data.length).to.be.above(0);
      expect(file.data).to.be.an.instanceof(Uint8Array);
    });

    it("should encode test file to WebM/Opus at MEMFS", function() {
      this.timeout(60000);
      var code;
      var res = ffmpeg_webm({
        arguments: [
          "-i", "test.webm",
          "-vn",
          "-c:a", "libopus",
          "out.webm",
        ],
        stdin: noop,
        print: noop,
        printErr: noop,
        onExit: function(v) {code = v},
        MEMFS: [{name: "test.webm", data: testData()}],
      });
      expect(code).to.equal(0);
      expect(res.MEMFS).to.have.length(1);
      var file = res.MEMFS[0];
      expect(file.name).to.equal("out.webm");
      expect(file.data.length).to.be.above(0);
      expect(file.data).to.be.an.instanceof(Uint8Array);
    });

    it("should accept ArrayBuffer in MEMFS input", function() {
      var code;
      ffmpeg_webm({
        arguments: [
          "-i", "test.webm",
          "-vn",
          "-frames:a", "1", "-c:a", "libopus",
          "-f", "null", "-",
        ],
        stdin: noop,
        print: noop,
        printErr: noop,
        onExit: function(v) {code = v},
        MEMFS: [{name: "test.webm", data: testData().buffer}],
      });
      expect(code).to.equal(0);
    });

    it("should accept Array in MEMFS input", function() {
      var data = Array.prototype.slice.call(testData());
      var code;
      ffmpeg_webm({
        arguments: [
          "-i", "test.webm",
          "-vn",
          "-frames:a", "1", "-c:a", "libopus",
          "-f", "null", "-",
        ],
        stdin: noop,
        print: noop,
        printErr: noop,
        onExit: function(v) {code = v},
        MEMFS: [{name: "test.webm", data: data}],
      });
      expect(code).to.equal(0);
    });

    it("should accept Uint16Array in MEMFS input", function() {
      var data = new Uint16Array(testData().buffer);
      var code;
      ffmpeg_webm({
        arguments: [
          "-i", "test.webm",
          "-vn",
          "-frames:a", "1", "-c:a", "libopus",
          "-f", "null", "-",
        ],
        stdin: noop,
        print: noop,
        printErr: noop,
        onExit: function(v) {code = v},
        MEMFS: [{name: "test.webm", data: data}],
      });
      expect(code).to.equal(0);
    });

    it("should work with crazy output name", function() {
      var code;
      var res = ffmpeg_webm({
        arguments: [
          "-i", "test.webm",
          "-vn",
          "-frames:a", "1", "-c:a", "libopus",
          "-f", "webm", "toString",
        ],
        stdin: noop,
        print: noop,
        printErr: noop,
        onExit: function(v) {code = v},
        MEMFS: [{name: "test.webm", data: testData()}],
      });
      expect(code).to.equal(0);
      expect(res.MEMFS).to.have.length(1);
      var file = res.MEMFS[0];
      expect(file.name).to.equal("toString");
      expect(file.data.length).to.be.above(0);
      expect(file.data).to.be.an.instanceof(Uint8Array);
    });

    it("should work with other crazy output name", function() {
      var res = ffmpeg_webm({
        arguments: [
          "-i", "test.webm",
          "-vn",
          "-frames:a", "1", "-c:a", "libopus",
          "-f", "webm", "__proto__",
        ],
        stdin: noop,
        print: noop,
        printErr: noop,
        MEMFS: [{name: "test.webm", data: testData()}],
      });
      expect(res.MEMFS).to.have.length(1);
      expect(res.MEMFS[0].name).to.equal("__proto__");
      expect(res.MEMFS[0].data.length).to.be.above(0);
    });

    it("should return empty array for empty output", function() {
      var res = ffmpeg_webm({
        arguments: [
          "-i", "test.webm",
          "-vf", "not_existent",
          "out.webm",
        ],
        stdin: noop,
        print: noop,
        printErr: noop,
        MEMFS: [{name: "test.webm", data: testData()}],
      });
      expect(res.MEMFS).to.have.length(1);
      expect(res.MEMFS[0].name).to.equal("out.webm");
      expect(res.MEMFS[0].data.length).to.equal(0);
    });

    it("should have subtitles filter", function() {
      var code;
      var res = ffmpeg_webm({
        arguments: [
          "-i", "test.webm",
          "-frames:v", "1", "-c:v", "libvpx",
          "-vf", "subtitles=test.webm",
          "-an", "-f", "null", "-",
        ],
        stdin: noop,
        print: noop,
        printErr: noop,
        onExit: function(v) {code = v},
        MEMFS: [{name: "test.webm", data: testData()}],
      });
      expect(code).to.equal(0);
    });

    it("should have Ogg muxer", function() {
      var res = ffmpeg_webm({
        arguments: [
          "-i", "test.webm",
          "-vn",
          "-frames:a", "1", "-c:a", "libopus",
          "out.ogg",
        ],
        stdin: noop,
        print: noop,
        printErr: noop,
        MEMFS: [{name: "test.webm", data: testData()}],
      });
      expect(res.MEMFS).to.have.length(1);
      var file = res.MEMFS[0];
      expect(file.name).to.equal("out.ogg");
      expect(file.data.length).to.be.above(0);
      expect(file.data).to.be.an.instanceof(Uint8Array);
    });

    it("should encode sequence of frames to WebM", function() {
      var res = ffmpeg_webm({
        // FIXME(Kagami): pattern_type=sequence doesn't work with NODEFS
        // for some reason.
        arguments: [
          "-pattern_type", "glob",
          "-i", "/data/test-frame*.jpg",
          "out.webm",
        ],
        stdin: noop,
        print: noop,
        printErr: noop,
        mounts: [{type: "NODEFS", opts: {root: "test"}, mountpoint: "/data"}],
      });
      var file = res.MEMFS[0];
      expect(file.name).to.equal("out.webm");
      expect(file.data.length).to.be.above(0);
    });
  });

  describe("Worker", function() {
    it("should print version to stdout", function(done) {
      var stdout = "";
      var stderr = "";
      var worker = new Worker("ffmpeg-worker-webm.js");
      worker.onerror = done;
      worker.onmessage = function(e) {
        var msg = e.data;
        switch (msg.type) {
        case "ready":
          worker.postMessage({type: "run", arguments: ["-version"]});
          break;
        case "stdout":
          stdout += msg.data + "\n";
          break;
        case "stderr":
          stderr += msg.data + "\n";
          break;
        case "exit":
          expect(stderr).to.be.empty;
          expect(msg.data).to.equal(0);
          expect(stdout).to.match(/^ffmpeg version /);
          // FIXME(Kagami): This cause segfault on Node 6.x.
          // worker.terminate();
          done();
          break;
        }
      };
    });

    // FIXME(Kagami): Blocked by:
    // <https://github.com/audreyt/node-webworker-threads/issues/60>.
    it.skip("should encode test file to WebM/VP8 at MEMFS", function(done) {
      this.timeout(60000);
      var worker = new Worker("ffmpeg-worker-webm.js");
      worker.onerror = done;
      worker.onmessage = function(e) {
        var msg = e.data;
        switch (msg.type) {
        case "ready":
          worker.postMessage({
            type: "run",
            arguments: [
              "-i", "test.webm",
              "-frames:v", "5", "-c:v", "libvpx",
              "-an",
              "out.webm",
            ],
            MEMFS: [{name: "test.webm", data: testData()}],
          });
          break;
        case "done":
          var mem = res.data.MEMFS;
          expect(mem).to.have.length(1);
          expect(mem[0].name).to.equal("out.webm");
          expect(mem[0].data.length).to.be.above(0);
          worker.terminate();
          done();
          break;
        }
      };
    });
  });
});

describe("MP4", function() {
  this.timeout(10000);

  describe("Sync", function() {
    it("should print version to stdout", function(done) {
      var stdout = "";
      var stderr = "";
      ffmpeg_mp4({
        arguments: ["-version"],
        print: function(data) { stdout += data + "\n"; },
        printErr: function(data) { stderr += data + "\n"; },
        onExit: function(code) {
          expect(code).to.equal(0);
          expect(stderr).to.be.empty;
          expect(stdout).to.match(/^ffmpeg version /);
          done();
        },
      });
    });

    it("should encode test file to MP4/H.264/MP3 at MEMFS", function() {
      this.timeout(60000);
      var code;
      var res = ffmpeg_mp4({
        arguments: [
          "-i", "test.webm",
          "-frames:v", "5", "-c:v", "libx264",
          "-c:a", "libmp3lame",
          "out.mp4",
        ],
        stdin: noop,
        print: noop,
        printErr: noop,
        onExit: function(v) {code = v},
        MEMFS: [{name: "test.webm", data: testData()}],
      });
      expect(code).to.equal(0);
      expect(res.MEMFS).to.have.length(1);
      var file = res.MEMFS[0];
      expect(file.name).to.equal("out.mp4");
      expect(file.data.length).to.be.above(0);
      expect(file.data).to.be.an.instanceof(Uint8Array);
    });

    it("should encode test file to MP4/AAC at MEMFS", function() {
      var res = ffmpeg_mp4({
        arguments: [
          "-i", "test.webm",
          "-vn",
          "-frames:a", "1", "-c:a", "aac",
          "out.mp4",
        ],
        stdin: noop,
        print: noop,
        printErr: noop,
        MEMFS: [{name: "test.webm", data: testData()}],
      });
      expect(res.MEMFS).to.have.length(1);
      var file = res.MEMFS[0];
      expect(file.name).to.equal("out.mp4");
      expect(file.data.length).to.be.above(0);
    });
  });

  // TODO(Kagami): Test worker builds with Karma. node-webworker-threads
  // has too many bugs.
  describe.skip("Worker", function() {
    it("should print version to stdout", function(done) {
      var stdout = "";
      var stderr = "";
      var worker = new Worker("ffmpeg-worker-mp4.js");
      worker.onerror = done;
      worker.onmessage = function(e) {
        var msg = e.data;
        switch (msg.type) {
        case "ready":
          worker.postMessage({type: "run", arguments: ["-version"]});
          break;
        case "stdout":
          stdout += msg.data + "\n";
          break;
        case "stderr":
          stderr += msg.data + "\n";
          break;
        case "exit":
          expect(stderr).to.be.empty;
          expect(msg.data).to.equal(0);
          expect(stdout).to.match(/^ffmpeg version /);
          worker.terminate();
          done();
          break;
        }
      };
    });
  });
});

describe("Youtube", function() {
  this.timeout(10000);

  describe("Sync", function() {
    it("should print version to stdout", function(done) {
      var stdout = "";
      var stderr = "";
      ffmpeg_youtube({
        arguments: ["-version"],
        print: function(data) { stdout += data + "\n"; },
        printErr: function(data) { stderr += data + "\n"; },
        onExit: function(code) {
          expect(code).to.equal(0);
          expect(stderr).to.be.empty;
          expect(stdout).to.match(/^ffmpeg version /);
          done();
        },
      });
    });

    it("should extract original audio from 3gp test file at MEMFS", function() {
      this.timeout(60000);
      var code;
      var res = ffmpeg_youtube({
        arguments: [
          "-i", "youtube.3gp",
          "-vn",
          "-c:a", "copy",
          "youtube.m4a",
        ],
        stdin: noop,
        print: noop,
        printErr: noop,
        onExit: function(v) {code = v},
        MEMFS: [{name: "youtube.3gp", data: testData('3gp', true)}],
      });
      expect(code).to.equal(0);
      expect(res.MEMFS).to.have.length(1);
      var file = res.MEMFS[0];
      expect(file.name).to.equal("youtube.m4a");
      expect(file.data.length).to.be.above(0);
      expect(file.data).to.be.an.instanceof(Uint8Array);
    });

    it("should extract original audio from mp4 test file at MEMFS", function() {
      this.timeout(60000);
      var code;
      var res = ffmpeg_youtube({
        arguments: [
          "-i", "youtube.mp4",
          "-vn",
          "-c:a", "copy",
          "youtube.m4a",
        ],
        stdin: noop,
        print: noop,
        printErr: noop,
        onExit: function(v) {code = v},
        MEMFS: [{name: "youtube.mp4", data: testData('mp4', true)}],
      });
      expect(code).to.equal(0);
      expect(res.MEMFS).to.have.length(1);
      var file = res.MEMFS[0];
      expect(file.name).to.equal("youtube.m4a");
      expect(file.data.length).to.be.above(0);
      expect(file.data).to.be.an.instanceof(Uint8Array);
    });

    it("should extract original audio from webm test file at MEMFS", function() {
      this.timeout(60000);
      var code;
      var res = ffmpeg_youtube({
        arguments: [
          "-i", "youtube.webm",
          "-vn",
          "-c:a", "copy",
          "youtube.ogg",
        ],
        stdin: noop,
        print: noop,
        printErr: noop,
        onExit: function(v) {code = v},
        MEMFS: [{name: "youtube.webm", data: testData('webm', true)}],
      });
      expect(code).to.equal(0);
      expect(res.MEMFS).to.have.length(1);
      var file = res.MEMFS[0];
      expect(file.name).to.equal("youtube.ogg");
      expect(file.data.length).to.be.above(0);
      expect(file.data).to.be.an.instanceof(Uint8Array);
    });

    it("should encode M4A/AAC test file to MP3 at MEMFS", function() {
      this.timeout(60000);
      var code;
      var res = ffmpeg_youtube({
        arguments: [
          "-i", "youtube.m4a",
          "-c:a", "libmp3lame",
          "youtube.mp3",
        ],
        stdin: noop,
        print: noop,
        printErr: noop,
        onExit: function(v) {code = v},
        MEMFS: [{name: "youtube.m4a", data: testData('m4a', true)}],
      });
      expect(code).to.equal(0);
      expect(res.MEMFS).to.have.length(1);
      var file = res.MEMFS[0];
      expect(file.name).to.equal("youtube.mp3");
      expect(file.data.length).to.be.above(0);
      expect(file.data).to.be.an.instanceof(Uint8Array);
    });

    it("should encode M4A/AAC test file to VORBIS at MEMFS", function() {
      this.timeout(60000);
      var code;
      var res = ffmpeg_youtube({
        arguments: [
          "-i", "youtube.m4a",
          "-c:a", "vorbis",
          '-strict', '-2',
          "youtube.ogg",
        ],
        stdin: noop,
        print: noop,
        printErr: noop,
        onExit: function(v) {code = v},
        MEMFS: [{name: "youtube.m4a", data: testData('m4a', true)}],
      });
      expect(code).to.equal(0);
      expect(res.MEMFS).to.have.length(1);
      var file = res.MEMFS[0];
      expect(file.name).to.equal("youtube.ogg");
      expect(file.data.length).to.be.above(0);
      expect(file.data).to.be.an.instanceof(Uint8Array);
    });

    it("should encode M4A/AAC test file to OPUS at MEMFS", function() {
      this.timeout(60000);
      var code;
      var res = ffmpeg_youtube({
        arguments: [
          "-i", "youtube.m4a",
          "-c:a", "libopus",
          "youtube.opus",
        ],
        stdin: noop,
        print: noop,
        printErr: noop,
        onExit: function(v) {code = v},
        MEMFS: [{name: "youtube.m4a", data: testData('m4a', true)}],
      });
      expect(code).to.equal(0);
      expect(res.MEMFS).to.have.length(1);
      var file = res.MEMFS[0];
      expect(file.name).to.equal("youtube.opus");
      expect(file.data.length).to.be.above(0);
      expect(file.data).to.be.an.instanceof(Uint8Array);
    });

    it("should encode OGG/VORBIS test file to MP3 at MEMFS", function() {
      this.timeout(60000);
      var code;
      var res = ffmpeg_youtube({
        arguments: [
          "-i", "youtube.ogg",
          "-c:a", "libmp3lame",
          "youtube.mp3",
        ],
        stdin: noop,
        print: noop,
        printErr: noop,
        onExit: function(v) {code = v},
        MEMFS: [{name: "youtube.ogg", data: testData('ogg', true)}],
      });
      expect(code).to.equal(0);
      expect(res.MEMFS).to.have.length(1);
      var file = res.MEMFS[0];
      expect(file.name).to.equal("youtube.mp3");
      expect(file.data.length).to.be.above(0);
      expect(file.data).to.be.an.instanceof(Uint8Array);
    });

    it("should encode OGG/VORBIS test file to AAC at MEMFS", function() {
      this.timeout(60000);
      var code;
      var res = ffmpeg_youtube({
        arguments: [
          "-i", "youtube.ogg",
          "-c:a", "aac",
          "youtube.m4a",
        ],
        stdin: noop,
        print: noop,
        printErr: noop,
        onExit: function(v) {code = v},
        MEMFS: [{name: "youtube.ogg", data: testData('ogg', true)}],
      });
      expect(code).to.equal(0);
      expect(res.MEMFS).to.have.length(1);
      var file = res.MEMFS[0];
      expect(file.name).to.equal("youtube.m4a");
      expect(file.data.length).to.be.above(0);
      expect(file.data).to.be.an.instanceof(Uint8Array);
    });

    it("should encode OGG/VORBIS test file to OPUS at MEMFS", function() {
      this.timeout(60000);
      var code;
      var res = ffmpeg_youtube({
        arguments: [
          "-i", "youtube.ogg",
          "-c:a", "libopus",
          "youtube.opus",
        ],
        stdin: noop,
        print: noop,
        printErr: noop,
        onExit: function(v) {code = v},
        MEMFS: [{name: "youtube.ogg", data: testData('ogg', true)}],
      });
      expect(code).to.equal(0);
      expect(res.MEMFS).to.have.length(1);
      var file = res.MEMFS[0];
      expect(file.name).to.equal("youtube.opus");
      expect(file.data.length).to.be.above(0);
      expect(file.data).to.be.an.instanceof(Uint8Array);
    });

    it("should encode OPUS test file to MP3 at MEMFS", function() {
      this.timeout(60000);
      var code;
      var res = ffmpeg_youtube({
        arguments: [
          "-i", "youtube.opus",
          "-c:a", "libmp3lame",
          "youtube.mp3",
        ],
        stdin: noop,
        print: noop,
        printErr: noop,
        onExit: function(v) {code = v},
        MEMFS: [{name: "youtube.opus", data: testData('opus', true)}],
      });
      expect(code).to.equal(0);
      expect(res.MEMFS).to.have.length(1);
      var file = res.MEMFS[0];
      expect(file.name).to.equal("youtube.mp3");
      expect(file.data.length).to.be.above(0);
      expect(file.data).to.be.an.instanceof(Uint8Array);
    });

    it("should encode OPUS test file to VORBIS at MEMFS", function() {
      this.timeout(60000);
      var code;
      var res = ffmpeg_youtube({
        arguments: [
          "-i", "youtube.opus",
          "-c:a", "vorbis",
          '-strict', '-2',
          "youtube.ogg",
        ],
        stdin: noop,
        print: noop,
        printErr: noop,
        onExit: function(v) {code = v},
        MEMFS: [{name: "youtube.opus", data: testData('opus', true)}],
      });
      expect(code).to.equal(0);
      expect(res.MEMFS).to.have.length(1);
      var file = res.MEMFS[0];
      expect(file.name).to.equal("youtube.ogg");
      expect(file.data.length).to.be.above(0);
      expect(file.data).to.be.an.instanceof(Uint8Array);
    });

    it("should encode OPUS test file to AAC at MEMFS", function() {
      this.timeout(60000);
      var code;
      var res = ffmpeg_youtube({
        arguments: [
          "-i", "youtube.opus",
          "-c:a", "aac",
          "youtube.m4a",
        ],
        stdin: noop,
        print: noop,
        printErr: noop,
        onExit: function(v) {code = v},
        MEMFS: [{name: "youtube.opus", data: testData('opus', true)}],
      });
      expect(code).to.equal(0);
      expect(res.MEMFS).to.have.length(1);
      var file = res.MEMFS[0];
      expect(file.name).to.equal("youtube.m4a");
      expect(file.data.length).to.be.above(0);
      expect(file.data).to.be.an.instanceof(Uint8Array);
    });

    it("should set metadata to M4A/AAC test file at MEMFS", function() {
      this.timeout(60000);
      var code;
      var infile = testData('m4a', true);
      var res = ffmpeg_youtube({
        arguments: [
          "-i", "youtube.m4a",
          "-metadata", "title='title'",
          "-metadata", "artist='artist'",
          "-c:a", "copy",
          "out.m4a",
        ],
        stdin: noop,
        print: noop,
        printErr: noop,
        onExit: function(v) {code = v},
        MEMFS: [{name: "youtube.m4a", data: infile}],
      });
      expect(code).to.equal(0);
      expect(res.MEMFS).to.have.length(1);
      var outfile = res.MEMFS[0];
      expect(outfile.name).to.equal("out.m4a");
      expect(outfile.data.length).to.be.above(0);
      expect(outfile.data).to.be.an.instanceof(Uint8Array);
      expect(md5(infile)).to.equal("704ac1f7377cd154103cbd59797b1ebf");
      expect(md5(outfile.data)).to.equal("5e077b88c502325f9704bf2347ba9324");
    });

    xit("should set metadata to OGG/VORBIS test file at MEMFS", function() {
      this.timeout(60000);
      var code;
      var infile = testData('ogg', true);
      var res = ffmpeg_youtube({
        arguments: [
          "-i", "youtube.ogg",
          "-metadata", "title='title'",
          "-metadata", "artist='artist'",
          "-c:a", "copy",
          "out.ogg",
        ],
        stdin: noop,
        print: noop,
        printErr: noop,
        onExit: function(v) {code = v},
        MEMFS: [{name: "youtube.ogg", data: infile}],
      });
      expect(code).to.equal(0);
      expect(res.MEMFS).to.have.length(1);
      var outfile = res.MEMFS[0];
      expect(outfile.name).to.equal("out.ogg");
      expect(outfile.data.length).to.be.above(0);
      expect(outfile.data).to.be.an.instanceof(Uint8Array);
      expect(md5(infile)).to.equal("c12956d2c401604e7177f51f9e4e8e54");
      expect(md5(outfile.data)).to.equal("f6ca501c6f0806967629d3eb69df8649"); // random
    });

    xit("should set metadata to OPUS test file at MEMFS", function() {
      this.timeout(60000);
      var code;
      var infile = testData('opus', true);
      var res = ffmpeg_youtube({
        arguments: [
          "-i", "youtube.opus",
          "-metadata", "title='title'",
          "-metadata", "artist='artist'",
          "-c:a", "copy",
          "out.opus",
        ],
        stdin: noop,
        print: noop,
        printErr: noop,
        onExit: function(v) {code = v},
        MEMFS: [{name: "youtube.opus", data: infile}],
      });
      expect(code).to.equal(0);
      expect(res.MEMFS).to.have.length(1);
      var outfile = res.MEMFS[0];
      expect(outfile.name).to.equal("out.opus");
      expect(outfile.data.length).to.be.above(0);
      expect(outfile.data).to.be.an.instanceof(Uint8Array);
      expect(md5(infile)).to.equal("8d5f0bea3b8b7367d8b2fe8676282fbf");
      expect(md5(outfile.data)).to.equal("210e54c63e81fbe076218fed8b00c355"); // random
    });

    it("should set metadata to MP3 test file at MEMFS", function() {
      this.timeout(60000);
      var code;
      var infile = testData('mp3', true);
      var res = ffmpeg_youtube({
        arguments: [
          "-i", "youtube.mp3",
          "-metadata", "title='title'",
          "-metadata", "artist='artist'",
          "-c:a", "copy",
          "out.mp3",
        ],
        stdin: noop,
        print: noop,
        printErr: noop,
        onExit: function(v) {code = v},
        MEMFS: [{name: "youtube.mp3", data: infile}],
      });
      expect(code).to.equal(0);
      expect(res.MEMFS).to.have.length(1);
      var outfile = res.MEMFS[0];
      expect(outfile.name).to.equal("out.mp3");
      expect(outfile.data.length).to.be.above(0);
      expect(outfile.data).to.be.an.instanceof(Uint8Array);
      expect(md5(infile)).to.equal("b2ec972a59aa30ef7dce456a6b706004");
      expect(md5(outfile.data)).to.equal("e25d7115ec22697be1873f3297af8fe1");
    });
  });

  // TODO(Kagami): Test worker builds with Karma. node-webworker-threads
  // has too many bugs.
  describe.skip("Worker", function() {
    it("should print version to stdout", function(done) {
      var stdout = "";
      var stderr = "";
      var worker = new Worker("ffmpeg-worker-youtube.js");
      worker.onerror = done;
      worker.onmessage = function(e) {
        var msg = e.data;
        switch (msg.type) {
        case "ready":
          worker.postMessage({type: "run", arguments: ["-version"]});
          break;
        case "stdout":
          stdout += msg.data + "\n";
          break;
        case "stderr":
          stderr += msg.data + "\n";
          break;
        case "exit":
          expect(stderr).to.be.empty;
          expect(msg.data).to.equal(0);
          expect(stdout).to.match(/^ffmpeg version /);
          worker.terminate();
          done();
          break;
        }
      };
    });
  });
});
