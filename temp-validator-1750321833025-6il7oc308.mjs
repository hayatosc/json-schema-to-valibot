
import * as v from 'valibot';

const schema = v.any()


export function validate(data) {
  try {
    v.parse(schema, data);
    return true;
  } catch (error) {
    return false;
  }
}
