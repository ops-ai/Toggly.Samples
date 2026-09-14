import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptance } from '../runner.mjs';
import { fixture } from './fixture.mjs';
for (const family of ['nest', 'solid', 'solidstart', 'sveltekit'])
  test(
    `LOCAL FIXTURE ONLY: ${family} update, isolation and cold recovery`,
    { timeout: 120000 },
    async () => {
      const service = await fixture();
      try {
        const stages = [];
        const result = await acceptance(
          {
            family,
            backendKey: 'fixture-backend',
            frontendKey: 'fixture-frontend',
            baseURI: service.baseURI,
            environment: 'Production',
            timeout: 15000,
          },
          async (stage) => {
            stages.push(stage);
            if (stage.endsWith('-off')) service.change(false);
            if (stage.endsWith('-on')) service.change(true);
          },
        );
        assert.equal(result.runtime, true);
        assert.equal(result.sampleUI, 'pending');
        assert.ok(stages.includes(family === 'nest' ? 'backend-off' : 'browser-off'));
      } finally {
        await service.close();
      }
    },
  );
test(
  'LOCAL FIXTURE ONLY: invalid signed backend response cannot satisfy live baseline',
  { timeout: 20000 },
  async () => {
    const service = await fixture({ invalid: true });
    try {
      await assert.rejects(
        acceptance({
          family: 'nest',
          backendKey: 'fixture',
          baseURI: service.baseURI,
          environment: 'Production',
          timeout: 1000,
        }),
        /Verified backend baseline/,
      );
    } finally {
      await service.close();
    }
  },
);
test(
  'LOCAL FIXTURE ONLY: HTTP state change without WS delivery must time out',
  { timeout: 20000 },
  async () => {
    const service = await fixture({ noFrames: true });
    try {
      await assert.rejects(
        acceptance(
          {
            family: 'nest',
            backendKey: 'fixture',
            baseURI: service.baseURI,
            environment: 'Production',
            timeout: 1000,
          },
          async (stage) => {
            if (stage === 'backend-off') service.change(false);
          },
        ),
        /backend frame\/signed refetch\/decision/,
      );
    } finally {
      await service.close();
    }
  },
);
test(
  'LOCAL FIXTURE ONLY: invalid signed frontend cannot satisfy baseline',
  { timeout: 35000 },
  async () => {
    const service = await fixture({ invalid: 'frontend' });
    try {
      await assert.rejects(
        acceptance({
          family: 'solid',
          frontendKey: 'fixture',
          baseURI: service.baseURI,
          environment: 'Production',
          timeout: 1000,
        }),
        /signed browser initialization\/context/,
      );
    } finally {
      await service.close();
    }
  },
);
test(
  'LOCAL FIXTURE ONLY: occupied host port fails without taking over another listener',
  { timeout: 10000 },
  async () => {
    const service = await fixture();
    try {
      await assert.rejects(
        acceptance({
          family: 'solid',
          frontendKey: 'fixture',
          baseURI: service.baseURI,
          environment: 'Production',
          port: Number(new URL(service.baseURI).port),
          timeout: 1000,
        }),
        { code: 'EADDRINUSE' },
      );
      assert.equal((await fetch(service.baseURI + '/.well-known/jwks')).status, 200);
    } finally {
      await service.close();
    }
  },
);
test(
  'LOCAL FIXTURE ONLY: cancellation while awaiting a live toggle releases the owned backend',
  { timeout: 10000 },
  async () => {
    const service = await fixture();
    const controller = new AbortController();
    try {
      await assert.rejects(
        acceptance(
          {
            family: 'nest',
            backendKey: 'fixture',
            baseURI: service.baseURI,
            environment: 'Production',
            timeout: 600000,
            signal: controller.signal,
          },
          async (stage) => {
            if (stage === 'backend-off') controller.abort();
          },
        ),
        { name: 'AbortError' },
      );
    } finally {
      await service.close();
    }
  },
);
