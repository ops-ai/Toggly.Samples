module ShowcaseHelper
  def state_badge(value)
    state = value ? 'on' : 'off'
    tag.span(value ? 'ON' : 'OFF', class: "badge #{state}", data: { toggly_state: state })
  end

  def section_title
    Catalog::SECTIONS.fetch(request.path, ['Showcase']).first
  end

  def flags_for(context)
    Catalog::FLAGS.to_h { |key| [key, Toggly.client.enabled?(key, context: context)] }
  end
end
