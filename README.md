UI for Serverspec
=======
Simple UI for serverspec tests results composed by [serverspec-core](https://github.com/gooddata/serverspec-core). It parses huge JSON from [serverspec-core](https://github.com/gooddata/serverspec-core) in `./reports` and save them as `.parsed` in the same folder, it also serves parsed reports via HTTP in fancy and user-readable form.

The intention is to group roles together so one can easily spot regressions, the intended structure is, as described in `server.js`:

```
         |  all   |  web   |
------------------------------------
  web1   | ✓ ✗ ✓  | ✓ ✓ ✓  |
  web2   | ✓ ✗ ✓  | ✓ ✓ ✓  |
  web3   | ✓ ✗    | ✓ ✓ ✓  |
------------------------------------
         |  all   |  memcache   |
------------------------------------
  memc1  | ✓ ✓ ✓  | ✓ ✓ ✓ ✓ ✓ ✓ |
  memc2  | ✓ ✓ ✓  | ✓     ✓     |
  memc3  | ✓ ✓ ✓  | ✓ ✓ ✓ ✓     |
------------------------------------
         |
------------------------------------
  unkn1  |
  unkn2  |
```

Installation
------------

Just `git clone git@github.com:gooddata/serverspec-ui.git` and run `node server.js`, by default it listens on [http://127.0.0.1:3000](http://127.0.0.1:3000). It is recommended to use [nginx](https://nginx.org) or any similar server as a forwarding proxy.

Configuration
-------------
There is no config file, all the settings are propagated via environment vars.


You can set where to listen with `PORT` (default *3000*) and `LISTEN` (defaults to *127.0.0.1*).

Also you can you set `REPORTS_DIR` and `SPEC_DIR` to overwrite default locations.
