import { DesktopApp } from './desktop/DesktopApp';
import { z } from 'zod';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './ui/App';
import { createPersistedStore } from './ui/persistence';
import './ui/base.css';
import { desktopService } from './desktop/service';
import { bindProjectService } from './desktop/project-service';
import { EditorStore } from './ui/editor-store';
import { createDefaultProject } from './core/project-model';

z.config(z.locales.zhCN());

const store = desktopService.api
  ? new EditorStore(createDefaultProject())
  : createPersistedStore({
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
    });

const service = desktopService.api
  ? bindProjectService(store, desktopService.api)
  : undefined;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.Fragment>
    {service ? (
      <DesktopApp store={store} service={service} />
    ) : (
      <React.StrictMode>
        <App store={store} />
      </React.StrictMode>
    )}
  </React.Fragment>,
);
