// Temporary module declaration to satisfy TypeScript when @types/react is not installed.
// This file avoids TS errors like: Cannot find module 'react/jsx-runtime' or its corresponding type declarations.
declare module 'react/jsx-runtime' {
  import * as React from 'react';
  export = React;
}

declare module 'react/jsx-dev-runtime' {
  import * as React from 'react';
  export = React;
}
