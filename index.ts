import React from 'react';
import { registerRootComponent } from 'expo';
import App from './App';
import UpdateGate from './src/components/UpdateGate';

function Root() {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(App),
    React.createElement(UpdateGate),
  );
}

registerRootComponent(Root);
