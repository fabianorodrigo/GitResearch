const bunyan = require('bunyan');
const RotatingFileStream = require('bunyan-rotating-file-stream');

const fs = require('fs');

module.exports.setupLogging = ({ logName }) => {
  if (!fs.existsSync('./logs')) {
    fs.mkdirSync('./logs');
  }

  const logOptions = {
    name: logName,
    streams: [
      {
        stream: new RotatingFileStream({
          level: 'debug',
          path: 'logs/log%Y%m%d.json',
          period: '1d', // daily rotation
          totalFiles: 10, // keep up to 10 back copies
          rotateExisting: true, // Give ourselves a clean file when we start up, based on period
          threshold: '10m', // Rotate log files larger than 10 megabytes
          totalSize: '20m', // Don't keep more than 20mb of archived log files
          gzip: true, // Compress the archive log files to save space
          src: true, // Include info about the source of the error
        }),
      },
    ],
  };

  global.log = bunyan.createLogger(logOptions);
};
