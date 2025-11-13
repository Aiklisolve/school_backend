import app from './app.js';
import { config } from './config/env.js';
import chalk from 'chalk';

const port = config.port;

app.listen(port, () => {
  console.log(
    chalk.green.bold(`🚀 Auth server running on `) +
      chalk.yellow(`http://localhost:${port}`)
  );
  console.log(chalk.cyan('Press CTRL+C to stop the server\n'));
});
