import morgan from 'morgan';
import chalk from 'chalk';

// Custom morgan logging format
const customFormat = morgan(function (tokens, req, res) {
  return [
    chalk.green(`[${tokens.method(req, res)}]`),
    chalk.yellow(tokens.url(req, res)),
    chalk.blue(`Status: ${tokens.status(req, res)}`),
    chalk.magenta(`${tokens['response-time'](req, res)} ms`)
  ].join(' ');
});

export default customFormat;
