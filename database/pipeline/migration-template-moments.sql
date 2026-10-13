-- ==========================================================
-- MIGRATION — Template Moments (2-3 ảnh connect)
-- ------------------------------------------------
-- Thêm template cho moments + bảng moment_collab (slot từng người).
-- Copy-paste toàn bộ file này vào TablePlus để chạy.
--
-- Bối cảnh:
--   - template = 'single'       → 1 ảnh dọc (hành vi cũ, moments.media_id có giá trị)
--   - template = 'duo_square'   → 2 ảnh vuông (2 người), ảnh nằm trong moment_collab
--   - template = 'trio_wide'    → 3 ảnh ngang (3 người), ảnh nằm trong moment_collab
--   - DRAFT (chưa đủ ảnh) tự huỷ sau 24h, KHÔNG hiện ở feed.
-- ==========================================================

-- 1) Thêm cột template vào moments
ALTER TABLE moments
    ADD COLUMN IF NOT EXISTS template VARCHAR(30) NOT NULL DEFAULT 'single';

-- 2) Cho phép media_id NULL với template duo/trio (ảnh sẽ nằm trong moment_collab)
ALTER TABLE moments
    ALTER COLUMN media_id DROP NOT NULL;

-- 3) Bảng slot collaborative — mỗi row = 1 người + 1 ô ảnh của moment
CREATE TABLE IF NOT EXISTS moment_collab (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    moment_id UUID NOT NULL REFERENCES moments (id) ON DELETE CASCADE,
    slot_index INT NOT NULL,          -- 0-based: 0 = creator, 1, 2 = bạn được mời
    user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    media_id UUID REFERENCES media (id) ON DELETE SET NULL, -- NULL = slot chưa điền ảnh
    filled_at TIMESTAMPTZ,            -- NULL = chưa filled (draft)
    created_at TIMESTAMPTZ DEFAULT now (),
    UNIQUE (moment_id, slot_index)
);

CREATE INDEX IF NOT EXISTS idx_moment_collab_moment ON moment_collab (moment_id);
CREATE INDEX IF NOT EXISTS idx_moment_collab_user ON moment_collab (user_id);

-- 4) Ràng buộc nhất quán: single phải có media_id; duo/trio thì media_id rỗng
--    (ảnh nằm hết trong moment_collab, không được lưu ở moments.media_id)
ALTER TABLE moments
    DROP CONSTRAINT IF EXISTS chk_template_media;
ALTER TABLE moments
    ADD CONSTRAINT chk_template_media CHECK (
        (template = 'single' AND media_id IS NOT NULL)
        OR (template IN ('duo_square', 'trio_wide') AND media_id IS NULL)
    );

-- 5) Số slot tối đa theo template (duo=2, trio=3) — ràng buộc cho moment_collab
ALTER TABLE moment_collab
    DROP CONSTRAINT IF EXISTS chk_collab_slot_count;

-- slot_index phải trong khoảng hợp lệ theo template (0..1 cho duo, 0..2 cho trio)
-- CHECK phụ thuộc template của moment cha → dùng trigger để đơn giản & chính xác.
CREATE OR REPLACE FUNCTION check_collab_slot_count()
RETURNS TRIGGER AS $$
DECLARE
    tpl VARCHAR(30);
    cnt INT;
    max_idx INT;
BEGIN
    SELECT template INTO tpl FROM moments WHERE id = NEW.moment_id;
    IF tpl = 'duo_square' THEN
        max_idx := 1;
    ELSIF tpl = 'trio_wide' THEN
        max_idx := 2;
    ELSE
        RAISE EXCEPTION 'moment không phải template collab (template=%', tpl;
    END IF;

    SELECT COUNT(*) INTO cnt FROM moment_collab
    WHERE moment_id = NEW.moment_id;
    -- Trước insert đã có `cnt` row; sau insert sẽ là cnt+1. Giới hạn = max_idx + 1.
    IF cnt > max_idx THEN
        RAISE EXCEPTION 'quá số slot (max=% cho template=%)', max_idx + 1, tpl;
    END IF;
    IF NEW.slot_index < 0 OR NEW.slot_index > max_idx THEN
        RAISE EXCEPTION 'slot_index=% nằm ngoài 0..% cho template=%', NEW.slot_index, max_idx, tpl;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_collab_slot_count ON moment_collab;
CREATE TRIGGER trg_collab_slot_count
    BEFORE INSERT OR UPDATE OF moment_id, slot_index
    ON moment_collab
    FOR EACH ROW
    EXECUTE FUNCTION check_collab_slot_count();