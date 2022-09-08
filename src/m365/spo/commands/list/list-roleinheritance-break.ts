import { Cli, Logger } from '../../../../cli';
import GlobalOptions from '../../../../GlobalOptions';
import request from '../../../../request';
import { formatting, validation } from '../../../../utils';
import SpoCommand from '../../../base/SpoCommand';
import commands from '../../commands';

interface CommandArgs {
  options: Options;
}

interface Options extends GlobalOptions {
  webUrl: string;
  listId?: string;
  listTitle?: string;
  clearExistingPermissions?: boolean;
  confirm?: boolean;
}

class SpoListRoleInheritanceBreakCommand extends SpoCommand {
  public get name(): string {
    return commands.LIST_ROLEINHERITANCE_BREAK;
  }

  public get description(): string {
    return 'Breaks role inheritance on list or library';
  }

  constructor() {
    super();

    this.#initTelemetry();
    this.#initOptions();
    this.#initValidators();
    this.#initOptionSets();
  }

  #initTelemetry(): void {
    this.telemetry.push((args: CommandArgs) => {
      Object.assign(this.telemetryProperties, {
        listId: typeof args.options.listId !== 'undefined',
        listTitle: typeof args.options.listTitle !== 'undefined',
        clearExistingPermissions: args.options.clearExistingPermissions === true,
        confirm: (!(!args.options.confirm)).toString()
      });
    });
  }

  #initOptions(): void {
    this.options.unshift(
      {
        option: '-u, --webUrl <webUrl>'
      },
      {
        option: '-i, --listId [listId]'
      },
      {
        option: '-t, --listTitle [listTitle]'
      },
      {
        option: '-c, --clearExistingPermissions'
      },
      {
        option: '--confirm'
      }
    );
  }

  #initValidators(): void {
    this.validators.push(
      async (args: CommandArgs) => {
        const isValidSharePointUrl: boolean | string = validation.isValidSharePointUrl(args.options.webUrl);
        if (isValidSharePointUrl !== true) {
          return isValidSharePointUrl;
        }

        if (args.options.listId && !validation.isValidGuid(args.options.listId)) {
          return `${args.options.listId} is not a valid GUID`;
        }

        return true;
      }
    );
  }

  #initOptionSets(): void {
    this.optionSets.push(['listId', 'listTitle']);
  }

  public commandAction(logger: Logger, args: CommandArgs, cb: () => void): void {
    if (this.verbose) {
      logger.logToStderr(`Breaking role inheritance of list in site at ${args.options.webUrl}...`);
    }

    const breakListRoleInheritance = (): void => {
      let requestUrl: string = `${args.options.webUrl}/_api/web/lists`;

      if (args.options.listId) {
        requestUrl += `(guid'${formatting.encodeQueryParameter(args.options.listId)}')`;
      }
      else {
        requestUrl += `/getbytitle('${formatting.encodeQueryParameter(args.options.listTitle as string)}')`;
      }

      let keepExistingPermissions: boolean = true;
      if (args.options.clearExistingPermissions) {
        keepExistingPermissions = !args.options.clearExistingPermissions;
      }

      const requestOptions: any = {
        url: `${requestUrl}/breakroleinheritance(${keepExistingPermissions})`,
        method: 'POST',
        headers: {
          'accept': 'application/json;odata=nometadata',
          'content-type': 'application/json'
        },
        responseType: 'json'
      };

      request
        .post(requestOptions)
        .then(_ => cb(), (err: any): void => this.handleRejectedODataJsonPromise(err, logger, cb));
    };

    if (args.options.confirm) {
      breakListRoleInheritance();
    }
    else {
      Cli.prompt({
        type: 'confirm',
        name: 'continue',
        default: false,
        message: `Are you sure you want to break the role inheritance of ${args.options.listId ?? args.options.listTitle}?`
      }, (result: { continue: boolean }): void => {
        if (!result.continue) {
          cb();
        }
        else {
          breakListRoleInheritance();
        }
      });
    }
  }
}

module.exports = new SpoListRoleInheritanceBreakCommand();