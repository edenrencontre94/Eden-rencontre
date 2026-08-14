-- =====================================================================================
-- 02_eden_rls.sql - Row Level Security (RLS) pour Eden Rencontre
-- =====================================================================================

-- 1. Profiles
-- Chacun peut voir les profils (sauf s'ils sont bloqués, mais on simplifie ici)
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
    FOR SELECT USING (true);

-- L'utilisateur ne peut modifier que son propre profil
CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can delete own profile" ON public.profiles
    FOR DELETE USING (auth.uid() = id);

-- 2. Swipes
-- Un utilisateur peut voir ses propres swipes (donnés ou reçus)
CREATE POLICY "Users can view their own swipes" ON public.swipes
    FOR SELECT USING (auth.uid() = actor_id OR auth.uid() = target_id);

-- Un utilisateur ne peut créer qu'un swipe en tant qu'actor
CREATE POLICY "Users can insert swipes as themselves" ON public.swipes
    FOR INSERT WITH CHECK (auth.uid() = actor_id);

-- Pas d'update ou delete de swipe en général (on les garde comme logs)

-- 3. Matches
-- Un utilisateur peut voir ses propres matches
CREATE POLICY "Users can view their matches" ON public.matches
    FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- L'insertion se fait via un trigger ou avec droits système, mais s'il faut depuis le client :
CREATE POLICY "Users can insert matches they are part of" ON public.matches
    FOR INSERT WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- 4. Messages
-- Un utilisateur peut voir les messages d'un match s'il fait partie de ce match
CREATE POLICY "Users can view messages of their matches" ON public.messages
    FOR SELECT USING (
        auth.uid() IN (
            SELECT m.user1_id FROM public.matches m WHERE m.id = match_id
            UNION
            SELECT m.user2_id FROM public.matches m WHERE m.id = match_id
        )
    );

-- Un utilisateur ne peut insérer un message que s'il est l'expéditeur et membre du match
CREATE POLICY "Users can insert messages to their matches" ON public.messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        auth.uid() IN (
            SELECT m.user1_id FROM public.matches m WHERE m.id = match_id
            UNION
            SELECT m.user2_id FROM public.matches m WHERE m.id = match_id
        )
    );

-- 5. Blocks & Reports
-- On peut voir ses propres blocks
CREATE POLICY "Users can view their blocks" ON public.blocks_reports
    FOR SELECT USING (auth.uid() = reporter_id);

CREATE POLICY "Users can insert blocks" ON public.blocks_reports
    FOR INSERT WITH CHECK (auth.uid() = reporter_id);
