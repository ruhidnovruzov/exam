const {
  findEtsDepartments,
  findEtsSubjects,
  findEtsTopics,
  findEtsSubjectGroups,
} = require('../services/etsImportService');

const handleEtsProxy = (fetchFn) => async (req, res) => {
  try {
    const data = await fetchFn(req);
    res.json(data);
  } catch (err) {
    console.error('[ETS proxy]', err.message);
    res.status(502).json({ message: 'ETS sorğusu uğursuz oldu' });
  }
};

const getDepartments = handleEtsProxy(() => findEtsDepartments());

const getSubjects = handleEtsProxy(() => findEtsSubjects());

const getTopics = handleEtsProxy(() => findEtsTopics());

const getSubjectGroups = handleEtsProxy((req) =>
  findEtsSubjectGroups({
    academicYear: req.query.academicYear,
    semester: req.query.semester,
    status: req.query.status,
    subjectId: req.query.subjectId,
  })
);

module.exports = {
  getDepartments,
  getSubjects,
  getTopics,
  getSubjectGroups,
};
