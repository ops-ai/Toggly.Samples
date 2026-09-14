defmodule Showcase.Context do
  @moduledoc "Demonstration presets; these claims are not authentication."
  @matching "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  @nonmatching "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0"
  def preset(mode) do
    matching = mode != "nonmatching"
    # Every socket gets its own value. Entity keys identify a domain record;
    # Vip is the attribute tested by the Order-bound ContextProperty condition.
    %{
      "identity" => if(matching, do: "alice", else: "bob"),
      "groups" => [],
      "claims" => %{"role" => if(matching, do: "admin", else: "user")},
      "request" => %{
        "country" => if(matching, do: "US", else: "CA"),
        "acceptLanguage" => if(matching, do: "en-US,en;q=0.9", else: "fr-FR,fr;q=0.9"),
        "userAgent" => if(matching, do: @matching, else: @nonmatching)
      },
      "entity" => %{
        "kind" => "Order",
        "key" => if(matching, do: "ord-vip", else: "ord-standard"),
        "attributes" => %{"Vip" => matching, "Total" => 120}
      }
    }
  end
end
