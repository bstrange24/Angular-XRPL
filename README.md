# XrplApp

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.15.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Run Test individually

Run test on Ubuntu
export CHROME_BIN=$(which chromium)
npx karma start

## NFT URLs

https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExMjhubGpubms0bXl5ZzM0cWE4azE5aTlyOHRyNmVhd2prcDc1am43ciZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/NxwglXLqMeOuRF3FHv/giphy.gif

https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExdHJ4OWR2YjFjN256cGNzZWJyYWwyOW14cm00MTN0ZHV5MnA3OTNodCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/KzcamVeEJlaxCE4OAt/giphy.gif

https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExbDh1YWRtbWV4eXowOWg5emRybmZ5a3E5OTJ4c3FlYXB2YmN4MWR5dSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/bLpUr8MnJdVMIkhWzc/giphy.gif

https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExemh2dDd2NmU2a3ExNmRpZnhrbXZ3cnAwbDNjdjNmbGZ4N3Zyc2kzYyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/wfc4Ee9nycnyis3czb/giphy.gif

https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExZmx1NDVpMmtkaGE5NTBvcTA0ejN3ZGtiOGF6OGo1eHJmaDY5cWNlcyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/jqfXdwlXbfgH3RDoh0/giphy.gif

## Run Test commands

cd xrpl-app &&
npm run test -- --watch=false --browsers=ChromeHeadless --include src/app/components/trustlines/trustlines.component.spec.ts

cd xrpl-app &&
npm run test -- --watch=false --browsers=ChromeHeadless --include src/app/components/send-xrp/send-xrp.component.spec.ts

cd xrpl-app &&
npm run test -- --watch=false --browsers=ChromeHeadless --include src/app/components/create-time-escrow/create-time-escrow.component.spec.ts
ng test --watch --browsers=Chrome --include src/app/components/create-time-escrow/create-time-escrow.component.spec.ts

cd xrpl-app &&
npm run test -- --watch=false --browsers=ChromeHeadless --include src/app/components/create-conditional-escrow/create-conditional-escrow.component.spec.ts
ng test --watch --browsers=Chrome --include src/app/components/create-conditional-escrow/create-conditional-escrow.component.spec.ts

cd xrpl-app &&
npm run test -- --watch=false --browsers=ChromeHeadless --include src/app/components/create-tickets/create-tickets.component.spec.ts
ng test --watch --browsers=Chrome --include src/app/components/create-tickets/create-tickets.component.spec.ts

cd xrpl-app &&
npm run test -- --watch=false --browsers=ChromeHeadless --include src/app/components/send-checks/send-checks.component.spec.ts
ng test --watch --browsers=Chrome --include src/app/components/send-checks/send-checks.component.spec.ts

cd xrpl-app &&
npm run test -- --watch=false --browsers=ChromeHeadless --include src/app/components/account-configurator/account-configurator.component.spec.ts
ng test --watch --browsers=Chrome --include src/app/components/account-configurator/account-configurator.component.spec.ts

cd xrpl-app &&
npm run test -- --watch=false --browsers=ChromeHeadless --include src/app/components/sign-transactions/sign-transactions.component.spec.ts
ng test --watch --browsers=Chrome --include src/app/components/sign-transactions/sign-transactions.component.spec.ts

cd xrpl-app &&
npm run test -- --watch=false --browsers=ChromeHeadless --include src/app/components/account-changes/account-changes.component.spec.ts
ng test --watch --browsers=Chrome --include src/app/components/account-changes/account-changes.component.spec.ts

Run proxy-server.js and Angular at the same time
npm install --save-dev concurrently
Modify package.json
"scripts": {
"start": "concurrently \"ng serve\" \"node proxy-server.js\""
}
Start with this
npm start

Nodemon + Concurrently (auto-restart backend on changes)
npm install --save-dev concurrently nodemon
"scripts": {
"start": "concurrently \"ng serve\" \"nodemon proxy-server.js\""
}
Start with this
npm start

## Issuer setup steps

1. Create issuer wallet and set account up
   Account Configuration Templates: Issuer
2. Create hot wallet. This receives token from issuer.
   Set trust line from hot wallet/operational address to issuer
3. Send tokens from issuer to the hot wallet/operational address. This is minting tokens
4. On the Cold Wallet (issuing address)
   Enable asfNoFreeze
   Disable Master key and set the Regular key to blackhole address
5. Any new account will set up trustline with issue and then the hot wallet/operational address will send the token to the new account
6. On the hot wallet/operational address
   Set asfRequiredAuth to stop user from setting trustlines to it since we want trustlines to the issuer.
   Set asfDepositAuth so no one can send it any tokens

## MPT Steps

1. Create MPT - This is the issuer
   Authorize destiation to issuer
2. Send MPT from issuer to destiation
3. Destination can create Escrow

{
"Name": "US Treasury Bill Token",
"Identifier": "USTBT",
"Issuer": "US Treasury",
"IssueDate": "2024-03-25",
"MaturityDate": "2025-03-25",
"FaceValue": 1000,
"InterestRate": 2.5,
"InterestFrequency": "Quarterly",
"Collateral": "US Government",
"Jurisdiction": "United States",
"RegulatoryCompliance": "SEC Regulations",
"SecurityType": "Treasury Bill",
"ExternalUrl": "https://example.com/t-bill-token-metadata.json"
}

ipfs://bafybeiexamplehash

did:xrpl:raWwLN6xwPcwpLTiuHYf8S8vFaQtRzK9ey
did:xrpl:raWwLN6xwPcwpLTiuHYf8S8vFaQtRzK9ey#keys-1
Ed25519VerificationKey2018
did:xrpl:raWwLN6xwPcwpLTiuHYf8S8vFaQtRzK9ey
GfHkE3R7C6oJtH58eTmRzR
did:xrpl:raWwLN6xwPcwpLTiuHYf8S8vFaQtRzK9ey#vcs
VerifiableCredentialService
https://example.com/vc/
did:xrpl:raWwLN6xwPcwpLTiuHYf8S8vFaQtRzK9ey#keys-1

Check if master key is disabled
IF IT IS
Check for multi sign
Check for reg key

Batch on Tickets and Account Flag Set
Date change in Escrow, Creds
