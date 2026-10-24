defmodule Showcase.Context do
  @moduledoc "Demonstration presets; these claims are not authentication."
  @matching "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  @nonmatching "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0"

  def preset(mode) do
    case mode do
      "matching" -> matching_context()
      "nonmatching" -> nonmatching_context()
      "non-matching" -> nonmatching_context()
      _ -> anonymous_context()
    end
  end

  defp matching_context do
    %{
      "identity" => "alice",
      "groups" => [],
      "claims" => %{"role" => "admin"},
      "request" => %{
        "country" => "US",
        "acceptLanguage" => "en-US,en;q=0.9",
        "userAgent" => @matching
      },
      "entity" => %{
        "kind" => "Order",
        "key" => "ord-vip",
        "attributes" => %{"Vip" => true, "Total" => 120}
      }
    }
  end

  defp nonmatching_context do
    %{
      "identity" => "bob",
      "groups" => [],
      "claims" => %{"role" => "user"},
      "request" => %{
        "country" => "CA",
        "acceptLanguage" => "fr-FR,fr;q=0.9",
        "userAgent" => @nonmatching
      },
      "entity" => %{
        "kind" => "Order",
        "key" => "ord-standard",
        "attributes" => %{"Vip" => false, "Total" => 120}
      }
    }
  end

  defp anonymous_context do
    %{
      "identity" => "",
      "groups" => [],
      "claims" => %{"role" => "user"},
      "request" => %{
        "country" => "",
        "acceptLanguage" => "",
        "userAgent" => ""
      },
      "entity" => %{
        "kind" => "Order",
        "key" => "ord-standard",
        "attributes" => %{"Vip" => false, "Total" => 120}
      }
    }
  end
end
