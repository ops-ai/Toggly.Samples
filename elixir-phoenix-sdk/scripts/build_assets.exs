# Copy the exact JS clients shipped by the resolved Hex dependencies. No npm
# bundle or checked-in vendor SDK is required; these assets are generated.
File.mkdir_p!("priv/static/assets")

File.cp!(
  Application.app_dir(:phoenix, "priv/static/phoenix.mjs"),
  "priv/static/assets/phoenix.mjs"
)

File.cp!(
  Application.app_dir(:phoenix_live_view, "priv/static/phoenix_live_view.esm.js"),
  "priv/static/assets/phoenix_live_view.esm.js"
)

File.cp!("assets/app.js", "priv/static/assets/app.js")
File.cp!("assets/app.css", "priv/static/assets/app.css")
