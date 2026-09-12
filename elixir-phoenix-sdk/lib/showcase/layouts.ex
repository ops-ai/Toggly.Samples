defmodule Showcase.Layouts do
  use Phoenix.Component

  def root(assigns) do
    ~H"""
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="csrf-token" content={Plug.CSRFProtection.get_csrf_token()} />
        <title>Toggly · Phoenix field guide</title>
        <link rel="stylesheet" href="/assets/app.css" />
        <script type="module" src="/assets/app.js"></script>
      </head>
      <body>{@inner_content}</body>
    </html>
    """
  end
end
