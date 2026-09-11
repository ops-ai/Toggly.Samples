# frozen_string_literal: true

require 'net/http'
require 'json'

# A separate cookie jar per browser makes cross-session leaks observable.
class HttpBrowser
  def initialize(url)
    @url = url
    @cookie = nil
  end

  def get(path)
    request(Net::HTTP::Get.new(path))
  end

  def post(path, values)
    message = Net::HTTP::Post.new(path)
    message.set_form_data(values)
    request(message)
  end

  def snapshot
    JSON.parse(get('/api/snapshot').body)
  end

  private

  def request(message)
    uri = URI(@url)
    message['Cookie'] = @cookie if @cookie
    http = Net::HTTP.new(uri.host, uri.port, nil)
    http.open_timeout = 3
    http.read_timeout = 5
    response = http.request(message)
    cookie = response.get_fields('set-cookie')&.first
    @cookie = cookie.split(';').first if cookie
    response
  end
end
