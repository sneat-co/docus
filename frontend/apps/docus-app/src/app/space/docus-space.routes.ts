import { Route } from '@angular/router';
import { docusRoutes as docusExtensionRoutes } from '@sneat/extension-docus-shared';
import { SpaceComponentBaseParams } from '@sneat/space-components';

// Thin, docus-only space shell. It provides SpaceComponentBaseParams (which
// resolves the active space from the :spaceType/:spaceID route params) to all
// children, then mounts ONLY the docus routes — unlike sneat-app's
// @sneat/space-pages, which bundles every extension. This keeps docus.app
// decoupled while reusing the published @sneat/space-components context wiring.
export const docusSpaceRoutes: Route[] = [
  {
    path: '',
    providers: [SpaceComponentBaseParams],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'documents',
      },
      ...docusExtensionRoutes,
    ],
  },
];
