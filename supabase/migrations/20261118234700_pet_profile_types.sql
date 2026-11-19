-- Issue #488 (part C of #460, «Profilo dell'animale»): enumerated types of the profile of a
-- pet. No table, no stored data.

-- «Specie» (answer 9 of #460): only these three. Never an «assistance dog», «guide dog» or
-- «pet therapy» value: it would reveal health data of a person of the household (legal
-- opinion of #460, section 1).
create type public.pet_species as enum ('dog', 'cat', 'other');

-- «Data»: the date of birth or the date the pet arrived in the household («Adozione»).
create type public.pet_date_kind as enum ('birth', 'adoption');

-- How precise the date is: the day, or only the year.
create type public.pet_date_precision as enum ('day', 'year');
