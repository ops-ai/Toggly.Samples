# Set up a Toggly sample application

Use this guide with the sample's README and the [shared flag template](FLAG_TEMPLATE.md).
The README supplies the exact application name, port, configuration variable
names, and native SDK parameter forms. The template supplies all sixteen flag
keys, the eleven filter rows, and the Matching/Non-matching presets.

These instructions were checked against the platform's source-defined controls
and management routes. They do not establish that your live workspace or
application has been configured. Stored technology labels and deployed UI
versions can differ from the source-defined labels below.

## Choose the application and technology

1. Sign in to [the Toggly dashboard](https://app.toggly.io). Use a workspace you
   can manage (the one created at signup is enough). You do not need a workspace
   named Toggly Samples. Use an account with permission to create applications
   in that workspace.
2. On **Applications**, choose **Add new application**. Enter the dedicated
   **{Stack} SDK Sample** name from the sample's README, such as **Java Spring
   WebFlux SDK Sample**. Check the workspace shown by **Adding to** before saving.
3. Select the matching **Technology Stack**. Adapter names are not always
   separate technology options:

   | Sample family | Technology label | Technology key |
   |---|---|---|
   | .NET | C# | `c-sharp` |
   | Java Servlet, Spring Boot, MVC, WebFlux | Java | `java` |
   | Python Django, Flask, FastAPI | Python | `python` |
   | PHP Laravel | Laravel | `laravel` |
   | PHP WordPress | WordPress | `wordpress` |
   | Ruby and Ruby on Rails | Ruby on Rails | `ruby-on-rails` |
   | Rust Actix, Axum, Rocket | Rust | `rust` |

   For other sample families, use the matching option specified by their README.
   Keep separate dedicated applications for separate samples, even when they use
   the same technology label. A row here identifies a technology; it does not
   imply that every adapter has a runnable folder in your checkout.
4. Set **Application URL** to the local URL from that sample's README and create
   the application. Use the **Production** environment for the shared exercise;
   create/select it if the workspace supplies different default environments.

### Local URLs and origins

For a client-side application, open its application settings and find **Allowed
Web Origins**. Enter each local origin from its README in **Origin URL**, then
choose **Add Origin**. Include the scheme and port: `http://localhost:3000` and
`http://127.0.0.1:3000` are different origins. Use your sample's actual port.
An origin has no page path; **Application URL** can include a path.

The current UI shows this CORS section only for apps with client-side access.
A server-only application's page can therefore have no **Allowed Web Origins**
control. Its server-to-server definitions requests do not use browser CORS.
Keep its documented local **Application URL**; do not switch technology or
enable browser access just to reveal the origin controls.

## Add the Order context and flags

1. Open the application's **Contexts** page
   (`/apps/{applicationId}/contexts`) and select **New Context**.
2. Set **Kind** to `Order`. Use **Add property** to define `Id` as `string`,
   `Vip` as `boolean`, and `Total` as `number`. Choose `Id` under **Key property**
   and **Save**. Optional `Total` describes the sample entity data; the editor
   has no per-property optional checkbox.
3. Create the five demo flags and eleven filter flags exactly as listed in
   [the template](FLAG_TEMPLATE.md#demo-flags). Check the **Key** rather than
   relying on an automatically formatted name: `ExpressCheckout` has that exact
   capitalization. Put the eleven `filter-*` flags in category **Filters**.
4. In the creation form or feature settings, choose **Order** in the **Context**
   field for `ExpressCheckout` and `filter-context-property`. Leave the other
   flags user-only. This binding is required before a ContextProperty rule can
   refer to `Order.Vip`.

The backend validates that a ContextProperty rule's kind matches the feature's
binding, that the kind and property exist in the application's catalog, and
that the operator/value fit the property type. It stamps the catalog's value
type onto the rule. Creating a rule does not create that context or binding.

## Configure visible conditions

Open the application's **Production** feature list
(`/apps/{applicationId}/environments/Production`). Clicking a flag's switch
opens its inline **Conditions** editor. For an already enabled or filtered flag,
this opens editing rather than immediately turning it off.

- For the four baseline toggles, use **Always On** when enabled. To disable one,
  turn off the switch inside the editor and select **Turn feature off**. An
  enabled baseline stores an AlwaysOn rule; disabled stores an empty list.
- For a filter flag, change the existing **User filter** selector to the desired
  available type and enter the template's values. **Add user filter** adds a
  rule row; it does not create a new filter type. Set each segment **Percentage**
  to **100**, including User Claims, so every matching identity is eligible.
  Keep `filter-percentage` at **50**.
- For either Order-bound flag, choose **Add condition on Order**, select `Vip`,
  equality (`eq`), and Boolean `true`. Remove the default AlwaysOn user row after
  adding the Order condition. Each of the eleven filter flags should retain
  only its intended rule; an extra AlwaysOn rule can enable a flag independently.

Select **Save conditions** to stage your edit in the page. The outer **Save
Changes** or **Request Changes** opens a confirmation dialog. Review the changes
there, then select **Save** or **Request** in that dialog to submit them. Complete
the account's normal approval workflow when requested.

The UI labels **Operating System** with selector ID `OS`; its values describe
operating systems such as Mac, separately from Device Type Macintosh. Targeting's
**Audience.Users** and **Audience.Groups** selectors refer to stored application
lists. Select a list whose members are the intended identities; do not treat
the literal identity `alice` as a list ID. The Time Window control is configured
as a time picker without a calendar; if it cannot express the exact template
timestamps, use the same management procedure below with your SDK's verified
rule parameters.

## When a filter is missing from the picker

The source-defined catalog omits **Percentage**, **Targeting**, and **TimeWindow**
for Java, Python, Laravel, WordPress, Ruby on Rails, and Rust. The other eight
shared filter types have no technology restriction in that catalog; Order
conditions use the separate entity editor described above. Their presence in
the catalog does not guarantee that every SDK supports their evaluation.

The management API can create custom filter metadata, but the current Angular
selector loads predefined filters only. Creating metadata therefore does not
make a hidden type selectable. Keep the application's correct technology and
use the ordinary single-feature management route for the dedicated sample flag.

### Read and replace one feature's rules

Use an **existing authorized management API client** or the dashboard's normal
authenticated session. The SDK app key in `TOGGLY_APP_KEY` or its framework
equivalent is not management authorization. No management credentials are
provided by this repository; do not export tokens or cookies into sample files.

The route accepts the existing signed-in session or a valid management JWT
Bearer token (the configured client's `Authorization: Bearer` header). It requires
authenticated API access and the normal team and
environment permissions: viewing for GET, editing for PUT. Keep any required
approvals in place. In an already configured API client, send `Accept:
application/json` and use `Content-Type: application/json` for PUT.

1. Obtain the **application short ID** from its dashboard URL or management
   response, not its SDK app key. Confirm **Production** and the exact existing
   feature key. Create the keys and Order binding first; this endpoint does not
   create them.
2. Read the current list using:

   ```http
   GET /api/v2/applications/{applicationId}/environments/Production/features/{featureKey}
   ```

   On the hosted dashboard this is
   `https://app.toggly.io/api/v2/applications/{applicationId}/environments/Production/features/{featureKey}`.
   A self-hosted installation uses its own dashboard origin. Replace the braces
   with the real short ID and key in your authorized client.
3. Keep the GET result for comparison. Prepare a JSON array containing that
   feature's complete intended filter list, using the sample's verified native
   evaluator names and parameters. Review the application, environment, key,
   and body before sending:

   ```http
   PUT /api/v2/applications/{applicationId}/environments/Production/features/{featureKey}
   Content-Type: application/json
   ```

   This replaces **only that feature/environment's entire rule list**. It does
   not append a rule, change other feature lists, update the application-level
   Context binding, or accept an SDK definitions envelope. Apply the shared
   recipe only to the dedicated sample flags. Replacing a feature's rules can
   stop a running experiment on that feature.
4. Complete normal approvals. An HTTP 200 response can accompany a pending
   change while returning the old applied rules; status alone is not proof that
   the new configuration is active. After the change is applied, GET the same
   feature again and compare the full list with your intended body.
5. Maintain these rules through the management client when the picker cannot
   represent their aliases or parameter schema. Reopening and saving them in
   that editor can discard parameter values. This also matters when raw indexed
   parameters differ from the editor's array controls.

### Java example bodies

These three bodies use the native forms exercised by the
[Java Spring WebFlux sample](https://github.com/ops-ai/Toggly.Samples/blob/553aaf3905f32e19cded833a5d0648ef04ae01eb/java-spring-webflux-sdk/README.md).
They illustrate the management endpoint's array body; they are not universal
parameter recipes for other languages.

For `filter-percentage`:

```json
[{"name":"Percentage","parameters":{"Value":50}}]
```

For `filter-targeting`:

```json
[{"name":"Targeting","parameters":{"users":"alice"}}]
```

For `filter-time-window`:

```json
[{"name":"TimeWindow","parameters":{"Start":"2020-01-01T00:00:00Z","End":"2099-12-31T23:59:59Z"}}]
```

Java accepts the `users` shorthand above. Another SDK may require different
native parameter names or indexed audience keys; use that sample's checked
README/fixture and SDK guide. The shared template specifies behavior, not a
cross-language JSON schema. In platform management input, the scalar keys
`Audience.Users` and `Audience.Groups` refer to stored application-list IDs,
not literal identities. The definitions pipeline expands those lists and
array-valued parameters into the SDK wire representation. Do not substitute
`"Audience.Users":"alice"` for the Java example.

## Verify the applied configuration

1. Check all sixteen feature keys in Production, including the two Order
   bindings, and read back any rules submitted through the management API.
2. Configure the sample with its app key using the README's ignored local
   configuration file or environment variables. Keep **Production** selected.
   Commit only empty/example configuration, never a real key.
3. Start or restart the sample, request its native refresh if offered, then
   reload. Follow its first-flag exercise by switching `new-dashboard` on and
   off and checking the corresponding page or gate result.
4. Run both exact [filter presets](FLAG_TEMPLATE.md#filters-category). AlwaysOn
   and the open TimeWindow remain on for both; Percentage remains sticky without
   a prescribed Alice/Bob outcome. Check each SDK's documented filter limitations
   before interpreting the rest of the matrix. Preserve the shared Macintosh
   device and Mac operating-system values even when an SDK reports a limitation.
5. Compare the VIP and standard Orders for `ExpressCheckout` and
   `filter-context-property` within their intended user context.

These are manual verification steps. A successful local build or deterministic
SDK test does not prove that your live application, local origins, Order catalog,
or flags exist. The management procedure above is based on platform source;
this guide does not claim a verified live dashboard-to-SDK provisioning run.
