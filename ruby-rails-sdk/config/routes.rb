Rails.application.routes.draw do
  root 'showcase#home'
  %w[gates api identity orders filters sdk setup].each do |section|
    get section, to: "showcase##{section}"
  end
  get '/api/snapshot', to: 'showcase#snapshot'
  get '/api/v2', to: 'actions#version_two'
  get '/beta', to: 'actions#beta'
  post '/context', to: 'context#update'
  post '/actions/submit', to: 'actions#submit'
  post '/actions/refresh', to: 'actions#refresh'
end
