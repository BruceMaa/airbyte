import { initialSetupCompleted } from "commands/workspaces";
import {
  getPostgresCreateDestinationBody,
  getPostgresCreateSourceBody,
  requestCreateDestination,
  requestCreateSource,
  requestDeleteConnection,
  requestDeleteDestination,
  requestDeleteSource,
  requestWorkspaceId,
} from "commands/api";
import { appendRandomString, submitButtonClick } from "commands/common";
import { clickNewConnectionButton, visitConnectionsListPage } from "pages/connnectionsListPage";
import {
  checkAmountOfStreamTableRows,
  checkColumnNames,
  checkConnectorIconAndTitle,
  clickUseExistingConnectorButton,
  isAtConnectionOverviewPage,
  isAtNewConnectionPage,
  isNewConnectionPageHeaderVisible,
  isStreamTableRowVisible,
  scrollTableToStream,
  selectExistingConnectorFromDropdown,
} from "pages/newConnectionPage";
import {
  interceptCreateConnectionRequest,
  interceptDiscoverSchemaRequest,
  interceptGetSourceDefinitionsRequest,
  interceptGetSourcesListRequest,
  waitForCreateConnectionRequest,
  waitForDiscoverSchemaRequest,
  waitForGetSourceDefinitionsRequest,
  waitForGetSourcesListRequest,
} from "commands/interceptors";
import { Connection, Destination, Source } from "commands/api/types";
import { clearStreamSearch, searchStream, selectSchedule } from "pages/replicationPage";
import { runDbQuery } from "commands/db/db";
import {
  createUsersTableQuery,
  dropUsersTableQuery,
  createDummyTablesQuery,
  dropDummyTablesQuery,
} from "commands/db/queries";

// TODO: Enable this test when the new stream table will be turned on
describe.skip("New stream table - new connection set up ", () => {
  let source: Source;
  let destination: Destination;
  let connectionId: string;

  before(() => {
    initialSetupCompleted();
    runDbQuery(dropUsersTableQuery);
    runDbQuery(dropDummyTablesQuery(20));

    runDbQuery(createUsersTableQuery);
    runDbQuery(createDummyTablesQuery(20));

    requestWorkspaceId().then(() => {
      const sourceRequestBody = getPostgresCreateSourceBody(appendRandomString("Stream table Source"));
      const destinationRequestBody = getPostgresCreateDestinationBody(appendRandomString("Stream table Destination"));

      requestCreateSource(sourceRequestBody).then((sourceResponse) => {
        source = sourceResponse;
        requestCreateDestination(destinationRequestBody).then((destinationResponse) => {
          destination = destinationResponse;
        });
      });
    });
  });

  after(() => {
    if (connectionId) {
      requestDeleteConnection(connectionId);
    }
    if (source) {
      requestDeleteSource(source.sourceId);
    }
    if (destination) {
      requestDeleteDestination(destination.destinationId);
    }
  });

  it("should open 'New connection' page", () => {
    visitConnectionsListPage();
    interceptGetSourcesListRequest();
    interceptGetSourceDefinitionsRequest();

    clickNewConnectionButton();
    waitForGetSourcesListRequest();
    waitForGetSourceDefinitionsRequest();
  });

  it("should select existing Source from dropdown and click button", () => {
    selectExistingConnectorFromDropdown(source.name);
    clickUseExistingConnectorButton("source");
  });

  it("should select existing Destination from dropdown and click button", () => {
    interceptDiscoverSchemaRequest();
    selectExistingConnectorFromDropdown(destination.name);
    clickUseExistingConnectorButton("destination");
    waitForDiscoverSchemaRequest();
  });

  it("should redirect to 'New connection' settings page with stream table'", () => {
    isAtNewConnectionPage();
  });

  it("should show 'New connection' page header", () => {
    isNewConnectionPageHeaderVisible();
  });

  it("should set 'Replication frequency' to 'Manual'", () => {
    selectSchedule("Manual");
  });

  it("should check check connector icons and titles in table", () => {
    checkConnectorIconAndTitle("source");
    checkConnectorIconAndTitle("destination");
  });

  it("should check columns names in table", () => {
    checkColumnNames();
  });

  it("should check total amount of table streams", () => {
    // dummy tables amount + users table
    checkAmountOfStreamTableRows(21);
  });

  it("should allow to scroll table to desired stream table row and it should be visible", () => {
    const desiredStreamTableRow = "dummy_table_18";

    scrollTableToStream(desiredStreamTableRow);
    isStreamTableRowVisible(desiredStreamTableRow);
  });

  it("should filter table by stream name", () => {
    searchStream("dummy_table_10");
    checkAmountOfStreamTableRows(1);
  });

  it("should clear stream search input field and show all available streams", () => {
    clearStreamSearch();
    checkAmountOfStreamTableRows(21);
  });

  /*
    here will be added more tests to extend the test flow
   */

  it("should set up a connection", () => {
    interceptCreateConnectionRequest();
    submitButtonClick(true);
    waitForCreateConnectionRequest().then((interception) => {
      assert.isNotNull(interception.response?.statusCode, "200");
      expect(interception.request.method).to.eq("POST");

      const connection: Partial<Connection> = {
        name: `${source.name} <> ${destination.name}`,
        scheduleType: "manual",
      };
      expect(interception.request.body).to.contain(connection);
      expect(interception.response?.body).to.contain(connection);

      connectionId = interception.response?.body?.connectionId;
    });
  });

  it("should redirect to connection overview page after connection set up", () => {
    isAtConnectionOverviewPage(connectionId);
  });
});
