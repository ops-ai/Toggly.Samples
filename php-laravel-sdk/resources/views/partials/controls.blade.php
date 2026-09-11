{{-- These bounded values are demo input, never trusted authorization claims. --}}
<form method="post" action="/controls" class="controls card">
    @csrf
    <div>
        <label for="preset">Identity and request preset</label>
        <select id="preset" name="preset">
            <option value="matching" @selected($runtime->
                context->preset === 'matching')>Matching · alice / admin / US / Chrome on Mac
            </option>
            <option value="non-matching" @selected($runtime->
                context->preset === 'non-matching')>Non-matching · bob / user / CA / Firefox on Windows
            </option>
        </select>
    </div>
    <div>
        <label for="order">Order entity (kept separate)</label>
        <select id="order" name="order">
            <option value="vip" @selected(($snapshot['order']['Id'] ?? '') === 'ord-vip')>
                ord-vip · Vip = true
            </option>
            <option value="standard" @selected(($snapshot['order']['Id'] ?? '') === 'ord-standard')>
                ord-standard · Vip = false
            </option>
            <option value="missing" @selected($snapshot['order'] === null)>
                Missing order
            </option>
        </select>
    </div>
    <div>
        <label for="scenario">Offline baseline flags</label>
        <select id="scenario" name="scenario">
            <option value="mixed" @selected($runtime->
                context->scenario === 'mixed')>Mixed · dashboard ON / API v2 OFF
            </option>
            <option value="all" @selected($runtime->
                context->scenario === 'all')>All baseline flags ON
            </option>
            <option value="off" @selected($runtime->
                context->scenario === 'off')>All baseline flags OFF
            </option>
        </select>
        <small>Only affects local baseline fixtures. Filter rules and ExpressCheckout stay intact; live flags are controlled in Toggly.</small>
    </div>
    <button type="submit">Apply to this session</button>
</form>
