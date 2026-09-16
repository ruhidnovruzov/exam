const { findEtsTeachers, findEtsTeacher } = require('../services/etsImportService');

// GET /api/muellimler
const getAll = async (req, res) => {
  try {
    const teachers = await findEtsTeachers();
    res.json(teachers);
  } catch (err) {
    console.error('[muellim/getAll]', err);
    res.status(502).json({ message: 'ETS-dən müəllimlər alınmadı' });
  }
};

// GET /api/muellimler/:id
const getOne = async (req, res) => {
  try {
    const teacher = await findEtsTeacher(req.params.id);
    if (!teacher) return res.status(404).json({ message: 'Müəllim tapılmadı' });
    res.json(teacher);
  } catch (err) {
    console.error('[muellim/getOne]', err);
    res.status(502).json({ message: 'ETS sorğusu uğursuz oldu' });
  }
};

module.exports = { getAll, getOne };