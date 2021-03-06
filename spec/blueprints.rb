require 'machinist/active_record'
require 'sham'
require 'faker'

Sham.name { Faker::Name.name }
Sham.login { Faker::Internet.user_name.gsub(/\W/, '') }
Sham.email { Faker::Internet.email }
Sham.title { Faker::Lorem.sentence }
Sham.body  { Faker::Lorem.paragraph }
Sham.url { "http://#{Faker::Internet.domain_name}" }

Taxon.blueprint do
  name { Sham.name }
  rank { Taxon::RANKS[rand(Taxon::RANKS.size)] }
end

TaxonName.blueprint do
  name { Sham.name }
  taxon
end

Observation.blueprint do
  user
end

User.blueprint do
  login { Sham.login }
  email { Sham.email }
  salt "9dadb9a490337c3e23dbc9bd20b08af841da4512"
  crypted_password "4ed912738a4c0facedbdfd4fd1db8c9245d93e40" # 'monkey'
  created_at 5.days.ago.to_s(:db)
  activated_at { 1.day.ago }
  state "active"
  time_zone "Pacific Time (US & Canada)"
end

Friendship.blueprint do
  user
  friend
end

ListedTaxon.blueprint do
  list
  taxon
end

List.blueprint do
  title { Sham.title }
end

LifeList.blueprint do
  user
end

ListRule.blueprint do
  list
end

Identification.blueprint do
  user
  observation
  taxon
end

TaxonLink.blueprint do
  user
  taxon
  url { Sham.url }
end

TaxonPhoto.blueprint do
  taxon
  photo
end

Photo.blueprint do
  user
  native_photo_id { rand(1000) }
end

CheckList.blueprint do
  place
end

Place.blueprint do
  name { Sham.title }
  latitude { rand(180) }
  longitude { rand(180) }
end

TaxonLink.blueprint do
  taxon
  url { Sham.url }
  site_title { Sham.title }
end

Project.blueprint do
  user
  title { Sham.title }
end

ProjectList.blueprint do
  project
end

ProjectUser.blueprint do
  user
  project
end

ProjectObservation.blueprint do
  observation
  project
end

Role.blueprint do
  name { Sham.title }
end

Role.blueprint(:admin) do
  name User::JEDI_MASTER_ROLE
end

Post.blueprint do
  user
  parent { user }
  title { Sham.title }
  body { Sham.body }
  published_at { Time.now }
end

Post.blueprint(:draft) do
  published_at { nil }
end
