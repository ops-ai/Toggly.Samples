# Plain immutable demo data; no ActiveRecord or database is required.
Order = Data.define(:id, :vip, :total) do
  def to_toggly_entity
    Toggly::EntityContext.new(
      kind: 'Order', key: id,
      attributes: { 'Vip' => vip, 'Total' => total }
    )
  end
end
