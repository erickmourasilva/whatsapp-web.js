/**
 * Expose a function to the page if it does not exist
 *
 * NOTE:
 * Rewrite it to 'upsertFunction' after updating Puppeteer to 20.6 or higher
 * using page.removeExposedFunction
 * https://pptr.dev/api/puppeteer.page.removeexposedfunction
 *
 * @param {object} page - Puppeteer Page instance
 * @param {string} name
 * @param {Function} fn
 */
async function exposeFunctionIfAbsent(page, name, fn) {
    const exist = await page.evaluate((name) => {
        return !!window[name];
    }, name);
    if (exist) {
        return;
    }
    await page.exposeFunction(name, fn);
}

/**
 * Poll a predicate from Node until it returns a truthy value.
 *
 * Unlike page.waitForFunction, the polling timer lives in Node, not in the page.
 * WhatsApp Web replaces the page's setTimeout (JSScheduler), and waits started
 * while it is still loading can stall forever (both with the default 'raf'
 * polling and with a numeric interval), so readiness is never observed.
 *
 * @param {object} page - Puppeteer Page instance
 * @param {Function} predicate - Runs in the page; must return a serializable value
 * @param {object} [options]
 * @param {number} [options.timeout=30000] - Max wait in ms
 * @param {number} [options.interval=200] - Delay between checks in ms
 * @param {AbortSignal} [options.signal] - Cancels the wait
 * @returns {Promise<*>} The first truthy value returned by the predicate
 */
async function pollPageUntil(
    page,
    predicate,
    { timeout = 30000, interval = 200, signal } = {},
) {
    const start = Date.now();
    for (;;) {
        if (signal?.aborted) {
            throw signal.reason ?? new Error('Aborted');
        }
        try {
            const result = await page.evaluate(predicate);
            if (result) return result;
        } catch (err) {
            // A navigation can destroy the execution context mid-check; retry.
            if (
                !String(err?.message || err).includes(
                    'Execution context was destroyed',
                )
            ) {
                throw err;
            }
        }
        if (Date.now() - start >= timeout) {
            throw new Error(`Waiting failed: ${timeout}ms exceeded`);
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
    }
}

module.exports = { exposeFunctionIfAbsent, pollPageUntil };
