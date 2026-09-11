module ShowcaseHelper
  def state_badge(value)
    tag.span(value ? 'ON' : 'OFF', class: "badge #{value ? 'on' : 'off'}")
  end

  def section_title
    Catalog::SECTIONS.fetch(request.path, ['Showcase']).first
  end

  def flags_for(context)
    Catalog::FLAGS.to_h { |key| [key, Toggly.client.enabled?(key, context: context)] }
  end
end
